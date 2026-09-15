const express = require("express");
const QRCode = require("qrcode");
const qrcode = require("qrcode-terminal");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.WHATSAPP_PORT || 3001);
// IMPORTANT: set this to a persistent volume on the host (for example /data/whatsapp-sessions).
const SESSION_ROOT = process.env.WHATSAPP_SESSION_ROOT || path.join(__dirname, "whatsapp-sessions");
const LEGACY_SESSION_ROOT = path.join(__dirname, "whatsapp-session");
const DEFAULT_SESSION_ID = process.env.WHATSAPP_SESSION_ID || "default";
const SEND_INTERVAL_MS = Math.max(500, Number(process.env.WHATSAPP_SEND_INTERVAL_MS || 1200));

app.use(express.json());

const sessions = new Map();
let shuttingDown = false;

function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

function safeSessionId(value) {
    const raw = String(value || DEFAULT_SESSION_ID).trim();
    return raw.replace(/[^a-zA-Z0-9_-]/g, "_") || "default";
}

function sessionPath(sessionId) { return path.join(SESSION_ROOT, safeSessionId(sessionId)); }

function createSessionState(sessionId) {
    return {
        id: safeSessionId(sessionId), sock: null, connected: false, qr: null, qrText: null,
        contacts: new Map(), contactsLoading: false, initialSyncDone: false,
        starting: false, reconnectTimer: null, refreshPromise: null, generation: 0,
        lastConnectionError: null, sendQueue: Promise.resolve(), sendQueueLength: 0, lastSendAt: 0,
    };
}

function getSession(sessionId) {
    const id = safeSessionId(sessionId);
    let state = sessions.get(id);
    if (!state) { state = createSessionState(id); sessions.set(id, state); }
    return state;
}

function hasAuthFiles(state) {
    const dir = sessionPath(state.id);
    try { return fs.existsSync(path.join(dir, "creds.json")); }
    catch (_) { return false; }
}

function normalizeNumber(value) {
    return String(value || "")
        .replace(/@s\.whatsapp\.net/g, "")
        .replace(/@c\.us/g, "")
        .replace(/@lid/g, "")
        .replace(/\D/g, "");
}

function normalizeSendNumber(value) {
    let number = normalizeNumber(value);
    if (number.startsWith("00")) number = number.slice(2);
    if (number.startsWith("0") && number.length === 10) number = "33" + number.slice(1);
    if (number.startsWith("33") && number.length === 11) return number;
    if (number.length >= 10) return number;
    return "";
}

// Contact import must only use real phone-number JIDs.
// @lid values are WhatsApp Linked IDs, not phone numbers, and must never be exposed as contacts.
function isPersonJid(jid) {
    return String(jid || "").endsWith("@s.whatsapp.net");
}

function looksLikePhoneName(value) {
    const name = String(value || "").trim();
    if (!name) return true;
    const digits = (name.match(/\d/g) || []).length;
    const letters = (name.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
    const compact = name.replace(/[\s+()._-]/g, "");
    return digits >= 6 && digits >= letters;
}

function contactName(contact) {
    // `name` is the address-book name. The other fields are only fallbacks when
    // WhatsApp/Baileys failed to populate that name correctly.
    const candidates = [
        contact?.name,
        contact?.shortName,
        contact?.notify,
        contact?.pushName,
        contact?.verifiedName,
    ];
    for (const candidate of candidates) {
        const value = String(candidate || "").trim();
        if (value && !looksLikePhoneName(value)) return value;
    }
    return "";
}

function normalizeContact(contact) {
    if (!contact) return null;
    const id = String(contact.id || contact.jid || "");
    if (!id || !isPersonJid(id)) return null;
    const number = normalizeNumber(contact.number || contact.phoneNumber || id.split("@")[0]);
    const name = contactName(contact);
    if (!number || !name) return null;
    return { id, name, number };
}

function upsertContacts(state, list) {
    if (!Array.isArray(list)) return 0;
    let changed = 0;
    for (const raw of list) {
        const contact = normalizeContact(raw);
        if (!contact) continue;
        const existing = state.contacts.get(contact.number);
        if (!existing || existing.id !== contact.id || existing.name !== contact.name) {
            state.contacts.set(contact.number, contact);
            changed++;
        }
    }
    return changed;
}

function sortedContacts(state) {
    return Array.from(state.contacts.values()).sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

function contactsFile(state) { return path.join(sessionPath(state.id), "contacts.json"); }

async function loadContactsCache(state) {
    try {
        const file = contactsFile(state);
        if (!fs.existsSync(file)) return;
        const data = JSON.parse(await fs.promises.readFile(file, "utf8"));
        if (Array.isArray(data)) upsertContacts(state, data);
        console.log(`📂 ${state.contacts.size} contacts cache chargés [${state.id}]`);
    } catch (error) { console.error(`❌ Cache contacts illisible [${state.id}] :`, error.message); }
}

async function saveContactsCache(state) {
    try {
        await fs.promises.mkdir(sessionPath(state.id), { recursive: true });
        await fs.promises.writeFile(contactsFile(state), JSON.stringify(sortedContacts(state), null, 2), "utf8");
    } catch (error) { console.error(`❌ Sauvegarde contacts impossible [${state.id}] :`, error.message); }
}

async function generateQR(state, qr) {
    state.qrText = qr;
    try { state.qr = await QRCode.toDataURL(qr); }
    catch (error) { console.error(`❌ Erreur génération QR [${state.id}] :`, error.message); state.qr = null; }
    console.log(`📱 NOUVEAU QR CODE [${state.id}]`);
    try { qrcode.generate(qr, { small: true }); } catch (_) {}
}

function statusCodeFrom(error) {
    try { return new Boom(error)?.output?.statusCode; } catch (_) { return undefined; }
}

async function destroySocket(state) {
    const old = state.sock;
    state.sock = null;
    if (!old) return;
    try { if (typeof old.end === "function") old.end(undefined); } catch (_) {}
    await sleep(250);
}

async function clearAuth(state) {
    const dir = sessionPath(state.id);
    try { await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); }
    catch (error) { console.error(`❌ Suppression session impossible [${state.id}] :`, error.message); }
    await fs.promises.mkdir(dir, { recursive: true });
}

function enqueueSend(state, task) {
    state.sendQueueLength++;
    const run = state.sendQueue.then(async () => {
        if (state.lastSendAt) {
            const wait = SEND_INTERVAL_MS - (Date.now() - state.lastSendAt);
            if (wait > 0) await sleep(wait);
        }
        try { return await task(); }
        finally { state.lastSendAt = Date.now(); }
    });
    state.sendQueue = run.catch(() => {});
    return run.finally(() => { state.sendQueueLength = Math.max(0, state.sendQueueLength - 1); });
}

async function sendText(state, to, message) {
    if (!state.sock || !state.connected) throw new Error("WhatsApp n'est pas connecté.");
    const number = normalizeSendNumber(to);
    if (!number) throw new Error("Numéro de téléphone invalide.");
    const jid = `${number}@s.whatsapp.net`;
    return enqueueSend(state, async () => {
        if (!state.sock || !state.connected) throw new Error("WhatsApp n'est pas connecté.");
        console.log(`📤 Envoi WhatsApp [${state.id}] → ${number}`);
        const result = await state.sock.sendMessage(jid, { text: String(message || "") });
        const messageId = result?.key?.id || null;
        if (!messageId) throw new Error("WhatsApp n'a pas retourné d'identifiant de message.");
        console.log(`✅ Message WhatsApp envoyé [${state.id}] → ${number} (${messageId})`);
        return { messageId, jid };
    });
}

async function startSession(state) {
    if (shuttingDown || state.starting || state.sock) return;
    state.starting = true;
    state.generation += 1;
    const generation = state.generation;
    try {
        const dir = sessionPath(state.id);
        await fs.promises.mkdir(dir, { recursive: true });
        const existingAuth = hasAuthFiles(state);
        console.log(`${existingAuth ? "🔐 SESSION EXISTANTE" : "🆕 AUCUNE SESSION"} [${state.id}] → ${dir}`);
        console.log(`🔄 Initialisation Baileys [${state.id}]...`);

        const { state: authState, saveCreds } = await useMultiFileAuthState(dir);
        const sock = makeWASocket({
            auth: authState,
            printQRInTerminal: false,
            browser: ["ShiftFlow", "Chrome", "1.0.0"],
            markOnlineOnConnect: false,
            syncFullHistory: false,
            connectTimeoutMs: 60000,
            defaultQueryTimeoutMs: 60000,
            keepAliveIntervalMs: 30000,
        });
        state.sock = sock;
        state.lastConnectionError = null;
        sock.ev.on("creds.update", saveCreds);

        sock.ev.on("connection.update", async update => {
            if (generation !== state.generation) return;
            const { connection, qr, lastDisconnect } = update;
            if (qr) {
                state.connected = false;
                state.initialSyncDone = false;
                await generateQR(state, qr);
            }
            if (connection === "open") {
                state.connected = true;
                state.qr = null;
                state.qrText = null;
                state.initialSyncDone = true;
                state.lastConnectionError = null;
                console.log(`✅ WHATSAPP CONNECTÉ [${state.id}]`);
            }
            if (connection === "close") {
                state.connected = false;
                const code = statusCodeFrom(lastDisconnect?.error);
                state.lastConnectionError = code ?? null;
                console.log(`❌ CONNEXION WHATSAPP FERMÉE [${state.id}] — code ${code ?? "inconnu"}`);

                if (code === DisconnectReason.loggedOut) {
                    console.log(`🚪 Logout réel détecté → suppression de la session [${state.id}]`);
                    await destroySocket(state);
                    await clearAuth(state);
                    state.qr = null;
                    state.qrText = null;
                    state.initialSyncDone = false;
                    state.sendQueue = Promise.resolve();
                    state.sendQueueLength = 0;
                    if (!shuttingDown) {
                        await sleep(500);
                        startSession(state).catch(error => console.error(`❌ Redémarrage après logout [${state.id}] :`, error));
                    }
                    return;
                }

                if (!shuttingDown && generation === state.generation) {
                    if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
                    state.reconnectTimer = setTimeout(async () => {
                        state.reconnectTimer = null;
                        await destroySocket(state);
                        if (!shuttingDown) startSession(state).catch(error => console.error(`❌ Reconnexion [${state.id}] :`, error));
                    }, 3000);
                    console.log(`🔄 Reconnexion automatique dans 3 secondes... [${state.id}]`);
                }
            }
        });

        sock.ev.on("contacts.set", async event => {
            const list = event?.contacts || [];
            const changed = upsertContacts(state, list);
            if (changed > 0) await saveContactsCache(state);
        });
        sock.ev.on("contacts.upsert", async list => {
            const changed = upsertContacts(state, Array.isArray(list) ? list : []);
            if (changed > 0) await saveContactsCache(state);
        });
        sock.ev.on("contacts.update", async list => {
            const changed = upsertContacts(state, Array.isArray(list) ? list : []);
            if (changed > 0) await saveContactsCache(state);
        });
        // Do NOT import contacts from messaging-history.set. History can contain
        // people who merely sent a message and are not in the phone address book.
        console.log(`✅ Socket Baileys créé [${state.id}].`);
    } catch (error) {
        state.connected = false;
        state.sock = null;
        console.error(`❌ Erreur initialisation Baileys [${state.id}] :`, error);
        if (!shuttingDown) setTimeout(() => startSession(state).catch(retryError => console.error(`❌ Nouvelle tentative [${state.id}] :`, retryError)), 3000);
    } finally { state.starting = false; }
}

async function refreshContacts(state) {
    if (!state.connected || !state.sock) throw new Error("WhatsApp n'est pas connecté.");
    if (state.refreshPromise) return state.refreshPromise;
    state.contactsLoading = true;
    state.refreshPromise = (async () => {
        const before = state.contacts.size;
        if (typeof state.sock.resyncAppState === "function") {
            try { await state.sock.resyncAppState(["regular"], true); }
            catch (error) { console.log(`⚠️ Resync contacts incomplet [${state.id}] : ${error.message}`); }
        }
        await sleep(3000);
        await saveContactsCache(state);
        const after = state.contacts.size;
        return { count: after, added: Math.max(0, after - before), previousCount: before };
    })();
    try { return await state.refreshPromise; }
    finally { state.refreshPromise = null; state.contactsLoading = false; }
}

function publicStatus(state) {
    return {
        connected: state.connected, hasQR: !!state.qr, qr: state.qr,
        contactCount: state.contacts.size, contactsLoading: state.contactsLoading,
        contactsLoaded: state.contacts.size > 0, initialSyncDone: state.initialSyncDone,
        starting: state.starting, sessionId: state.id, lastConnectionError: state.lastConnectionError,
        sendQueueLength: state.sendQueueLength,
    };
}

function sessionFromRequest(req) {
    return safeSessionId(req.header("x-whatsapp-session") || req.query.sessionId || req.body?.sessionId || DEFAULT_SESSION_ID);
}

app.get("/status", async (req, res) => {
    const state = getSession(sessionFromRequest(req));
    await loadContactsCache(state);
    if (!state.sock && !state.starting && !shuttingDown) startSession(state).catch(error => console.error(`❌ Impossible de démarrer [${state.id}] :`, error));
    res.json(publicStatus(state));
});

app.get("/contacts", async (req, res) => {
    const state = getSession(sessionFromRequest(req));
    await loadContactsCache(state);
    if (!state.connected) return res.status(400).json({ error: "WhatsApp n'est pas connecté.", ...publicStatus(state) });
    res.json(sortedContacts(state));
});

app.get("/whatsapp/qr", (req, res) => {
    const state = getSession(sessionFromRequest(req));
    if (!state.qr) return res.status(404).json({ error: "Aucun QR code disponible." });
    res.json({ qr: state.qr });
});

app.post("/refresh", async (req, res) => {
    const state = getSession(sessionFromRequest(req));
    try { res.json({ success: true, ...(await refreshContacts(state)) }); }
    catch (error) { res.status(400).json({ success: false, error: error.message }); }
});

app.post("/send", async (req, res) => {
    const state = getSession(sessionFromRequest(req));
    const { to, message } = req.body || {};
    if (!message || !String(message).trim()) return res.status(400).json({ error: "Message vide." });
    if (!to) return res.status(400).json({ error: "Numéro de téléphone manquant." });
    try { res.json({ success: true, ...(await sendText(state, to, message)) }); }
    catch (error) {
        console.error(`❌ Envoi WhatsApp échoué [${state.id}] :`, error.message);
        res.status(400).json({ success: false, error: error.message });
    }
});

app.get("/send/status", (req, res) => {
    const state = getSession(sessionFromRequest(req));
    res.json({ connected: state.connected, queueLength: state.sendQueueLength, lastSendAt: state.lastSendAt || null });
});

app.post("/session/start", async (req, res) => {
    const state = getSession(sessionFromRequest(req));
    startSession(state).catch(error => console.error(`❌ Erreur démarrage [${state.id}] :`, error));
    res.json({ success: true, ...publicStatus(state) });
});

app.post("/session/logout", async (req, res) => {
    const state = getSession(sessionFromRequest(req));
    if (state.reconnectTimer) { clearTimeout(state.reconnectTimer); state.reconnectTimer = null; }
    if (state.sock && state.connected) {
        try { await state.sock.logout(); } catch (error) { console.log(`⚠️ Logout socket [${state.id}] : ${error.message}`); }
    } else {
        await destroySocket(state);
        await clearAuth(state);
        state.connected = false; state.qr = null; state.qrText = null; state.initialSyncDone = false;
        state.contacts.clear(); state.sendQueue = Promise.resolve(); state.sendQueueLength = 0;
        if (!shuttingDown) {
            await sleep(500);
            startSession(state).catch(error => console.error(`❌ Redémarrage session [${state.id}] :`, error));
        }
    }
    res.json({ success: true });
});

app.get("/", (req, res) => res.json({ service: "ShiftFlow WhatsApp", provider: "Baileys", status: "ok" }));

async function discoverExistingSessions() {
    try {
        const entries = await fs.promises.readdir(SESSION_ROOT, { withFileTypes: true });
        return entries.filter(entry => entry.isDirectory()).map(entry => safeSessionId(entry.name)).filter(Boolean);
    } catch (error) {
        console.error(`❌ Impossible de lire le dossier des sessions :`, error.message);
        return [];
    }
}

async function bootstrap() {
    await fs.promises.mkdir(SESSION_ROOT, { recursive: true });
    console.log("🚀 SHIFTLOW - WHATSAPP BAILEYS SERVICE");
    console.log(`📁 Sessions persistantes : ${SESSION_ROOT}`);
    console.log(`🌐 Port : ${PORT}`);

    const defaultDir = sessionPath(DEFAULT_SESSION_ID);
    if (DEFAULT_SESSION_ID === "default" && fs.existsSync(LEGACY_SESSION_ROOT) && !fs.existsSync(defaultDir)) {
        await fs.promises.rename(LEGACY_SESSION_ROOT, defaultDir).catch(() => {});
    }

    // Restore every existing session instead of creating a fresh "default" session.
    const existing = await discoverExistingSessions();
    if (existing.length > 0) {
        console.log(`♻️ Sessions existantes détectées : ${existing.join(", ")}`);
        for (const id of existing) {
            const state = getSession(id);
            await loadContactsCache(state);
            startSession(state).catch(error => console.error(`❌ Restauration session [${id}] :`, error));
        }
    } else {
        console.log("ℹ️ Aucune session sauvegardée au démarrage. Une session sera créée à la demande via /status.");
    }

    app.listen(PORT, () => console.log(`🌐 Serveur lancé sur le port ${PORT}`));
}

async function shutdown(signal) {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log(`🛑 Arrêt du service (${signal})...`);
    for (const state of sessions.values()) {
        if (state.reconnectTimer) clearTimeout(state.reconnectTimer);
        await destroySocket(state);
    }
    process.exit(0);
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

bootstrap().catch(error => {
    console.error("❌ Échec du démarrage du service WhatsApp :", error);
    process.exit(1);
});
