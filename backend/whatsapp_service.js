const express = require("express");
const QRCode = require("qrcode");
const makeWASocket = require("@whiskeysockets/baileys").default;
const { DisconnectReason, useMultiFileAuthState } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = Number(process.env.WHATSAPP_PORT || 3001);
const SESSION_ROOT = process.env.WHATSAPP_SESSION_ROOT || path.join(__dirname, "whatsapp-sessions");
const LEGACY_SESSION_ROOT = path.join(__dirname, "whatsapp-session");
const DEFAULT_SESSION_ID = process.env.WHATSAPP_SESSION_ID || "default";
const SEND_INTERVAL_MS = Math.max(500, Number(process.env.WHATSAPP_SEND_INTERVAL_MS || 1200));
const REFRESH_COOLDOWN_MS = 60 * 1000;
const SHIFTFLOW_API_BASE_URL = String(process.env.SHIFTFLOW_API_BASE_URL || "https://shiftflow.io").replace(/\/$/, "");
const REMINDER_SCHEDULER_INTERVAL_MS = Math.max(60 * 1000, Number(process.env.REMINDER_SCHEDULER_INTERVAL_MS || 15 * 60 * 1000));
const REMINDER_CRON_SECRET = String(process.env.WEBHOOK_CRON_SECRET || "").trim();

app.use(express.json());
const sessions = new Map();
let shuttingDown = false;
let reminderSchedulerInterval = null;
let reminderSchedulerBootstrapTimer = null;
let reminderSchedulerRunning = false;
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function runReminderSchedulerTick() {
    if (shuttingDown || reminderSchedulerRunning || !REMINDER_CRON_SECRET) return;
    reminderSchedulerRunning = true;
    const bucket = Math.floor(Date.now() / REMINDER_SCHEDULER_INTERVAL_MS);
    const runId = `railway-reminders-${bucket}`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 60 * 1000);

    try {
        const response = await fetch(`${SHIFTFLOW_API_BASE_URL}/api/cron/reminders`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${REMINDER_CRON_SECRET}`,
                "X-Webhook-Id": runId,
                "Content-Type": "application/json",
            },
            body: "{}",
            signal: controller.signal,
        });
        const raw = await response.text();
        let data = null;
        try { data = raw ? JSON.parse(raw) : null; } catch (_) {}

        if (!response.ok) {
            console.error(`❌ Scheduler rappels HTTP ${response.status}: ${data?.detail || raw || "erreur inconnue"}`);
            return;
        }

        if (data?.duplicate) {
            console.log(`⏭️ Scheduler rappels déjà exécuté pour ce créneau [${runId}]`);
        } else {
            console.log(`⏰ Scheduler rappels OK [${runId}] : ${Number(data?.sent || 0)} rappel(s) envoyé(s)`);
        }
    } catch (error) {
        const label = error?.name === "AbortError" ? "timeout" : error?.message || String(error);
        console.error(`❌ Scheduler rappels impossible : ${label}`);
    } finally {
        clearTimeout(timeout);
        reminderSchedulerRunning = false;
    }
}

function startReminderScheduler() {
    if (!REMINDER_CRON_SECRET) {
        console.log("⚠️ Scheduler rappels désactivé : WEBHOOK_CRON_SECRET absent sur Railway");
        return;
    }
    console.log(`⏰ Scheduler rappels actif : vérification toutes les ${Math.round(REMINDER_SCHEDULER_INTERVAL_MS / 60000)} min via ${SHIFTFLOW_API_BASE_URL}`);

    // Catch up shortly after every Railway restart, then keep checking.
    reminderSchedulerBootstrapTimer = setTimeout(() => {
        runReminderSchedulerTick().catch(() => {});
    }, 10 * 1000);

    reminderSchedulerInterval = setInterval(() => {
        runReminderSchedulerTick().catch(() => {});
    }, REMINDER_SCHEDULER_INTERVAL_MS);
}
function safeSessionId(value) { const raw = String(value || DEFAULT_SESSION_ID).trim(); return raw.replace(/[^a-zA-Z0-9_-]/g, "_") || "default"; }
function sessionPath(sessionId) { return path.join(SESSION_ROOT, safeSessionId(sessionId)); }
function createSessionState(sessionId) { return { id: safeSessionId(sessionId), sock: null, connected: false, qr: null, qrText: null, contacts: new Map(), pendingLidContacts: new Map(), lidToPhone: new Map(), contactsLoading: false, initialSyncDone: false, initialAutoRefreshAttempted: false, starting: false, reconnectTimer: null, refreshPromise: null, resetPromise: null, lastRefreshAt: 0, generation: 0, lastConnectionError: null, sendQueue: Promise.resolve(), sendQueueLength: 0, lastSendAt: 0 }; }
function getSession(sessionId) { const id = safeSessionId(sessionId); let state = sessions.get(id); if (!state) { state = createSessionState(id); sessions.set(id, state); } return state; }
function hasAuthFiles(state) { try { return fs.existsSync(path.join(sessionPath(state.id), "creds.json")); } catch (_) { return false; } }
function normalizeNumber(value) { return String(value || "").replace(/@s\.whatsapp\.net/g, "").replace(/@c\.us/g, "").replace(/@lid/g, "").replace(/\D/g, ""); }
function normalizeSendNumber(value) { let number = normalizeNumber(value); if (number.startsWith("00")) number = number.slice(2); if (number.startsWith("0") && number.length === 10) number = "33" + number.slice(1); if (number.startsWith("33") && number.length === 11) return number; if (number.length >= 10) return number; return ""; }
function isPersonJid(jid) { return String(jid || "").endsWith("@s.whatsapp.net"); }
function isLidJid(jid) { return String(jid || "").endsWith("@lid"); }
function looksLikePhoneName(value) { const name = String(value || "").trim(); if (!name) return true; const digits = (name.match(/\d/g) || []).length; const letters = (name.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length; if (!letters && digits >= 2) return true; return digits >= 6 && digits >= letters; }
function explicitPhoneNumber(contact) { const candidates = [contact?.phoneNumber, contact?.number]; for (const candidate of candidates) { const number = normalizeNumber(candidate); if (/^\d{10,15}$/.test(number)) return number; } return ""; }
function contactName(contact) { const addressBookName = String(contact?.name || contact?.shortName || "").trim(); if (addressBookName && !looksLikePhoneName(addressBookName)) return addressBookName; const fallbacks = [contact?.notify, contact?.pushName, contact?.verifiedName]; for (const candidate of fallbacks) { const value = String(candidate || "").trim(); if (value && !looksLikePhoneName(value)) return value; } return ""; }
async function resolveLidPhone(state, lid, contact) { const explicit = explicitPhoneNumber(contact); const lidDigits = normalizeNumber(lid); if (explicit && explicit !== lidDigits) return explicit; const cached = state.lidToPhone.get(lid); if (cached && cached !== lidDigits) return cached; const mapping = state.sock?.signalRepository?.lidMapping; if (mapping && typeof mapping.getPNForLID === "function") { try { const pn = await mapping.getPNForLID(lid); const number = normalizeNumber(pn); if (/^\d{10,15}$/.test(number) && number !== lidDigits) { state.lidToPhone.set(lid, number); return number; } } catch (_) {} } return ""; }
async function normalizeContact(state, contact, source = "address_book") {
    if (!contact) return null;
    const id = String(contact.id || contact.jid || "");
    if (!id || (!isPersonJid(id) && !isLidJid(id))) return null;
    const name = contactName(contact);
    if (!name) return null;

    let number = "";
    if (isPersonJid(id)) {
        number = normalizeNumber(contact?.number || contact?.phoneNumber || id.split("@")[0]);
        if (!/^\d{10,15}$/.test(number)) return null;
    } else {
        number = await resolveLidPhone(state, id, contact);
        if (!number) {
            state.pendingLidContacts.set(id, { ...contact, id, _shiftflowSource: source });
            return null;
        }
    }

    return { id, name, number, source };
}

async function upsertContacts(state, list, source = "address_book") {
    if (!Array.isArray(list)) return 0;
    let changed = 0;
    for (const raw of list) {
        const contact = await normalizeContact(state, raw, source);
        if (!contact) continue;
        state.pendingLidContacts.delete(contact.id);
        const existing = state.contacts.get(contact.number);
        if (!existing || existing.id !== contact.id || existing.name !== contact.name || existing.source !== contact.source) {
            state.contacts.set(contact.number, contact);
            changed++;
        }
    }
    return changed;
}

function sortedContacts(state) {
    return Array.from(state.contacts.values())
        .filter(contact => contact.source === "address_book")
        .sort((a, b) => a.name.localeCompare(b.name, "fr", { sensitivity: "base" }));
}

function contactsFile(state) { return path.join(sessionPath(state.id), "contacts.json"); }

async function loadContactsCache(state) {
    try {
        const file = contactsFile(state);
        if (!fs.existsSync(file)) return;
        const data = JSON.parse(await fs.promises.readFile(file, "utf8"));
        if (!Array.isArray(data)) return;

        // Older ShiftFlow versions cached chat/history push-names as if they
        // were phonebook contacts. Never re-import that polluted cache.
        const trusted = data.filter(contact => contact?.source === "address_book");
        if (trusted.length !== data.length) {
            state.contacts.clear();
            await fs.promises.rm(file, { force: true });
            console.log(`🧹 Ancien cache contacts ignoré [${state.id}] (${data.length} entrées non fiables)`);
            return;
        }

        state.contacts.clear();
        await upsertContacts(state, trusted, "address_book");
        console.log(`📂 ${state.contacts.size} contacts carnet chargés [${state.id}]`);
    } catch (error) {
        console.error(`❌ Cache contacts illisible [${state.id}] :`, error.message);
    }
}
async function saveContactsCache(state) { try { await fs.promises.mkdir(sessionPath(state.id), { recursive: true }); await fs.promises.writeFile(contactsFile(state), JSON.stringify(sortedContacts(state), null, 2), "utf8"); } catch (error) { console.error(`❌ Sauvegarde contacts impossible [${state.id}] :`, error.message); } }
async function generateQR(state, qr) { state.qrText = qr; try { state.qr = await QRCode.toDataURL(qr); console.log(`📱 QR WhatsApp généré [${state.id}]`); } catch (error) { console.error(`❌ Erreur génération QR [${state.id}] :`, error.message); state.qr = null; } }
function statusCodeFrom(error) { try { return new Boom(error)?.output?.statusCode; } catch (_) { return undefined; } }
async function destroySocket(state) { const old = state.sock; state.sock = null; if (!old) return; try { if (typeof old.end === "function") old.end(undefined); } catch (_) {} await sleep(250); }
async function clearAuth(state) { const dir = sessionPath(state.id); try { await fs.promises.rm(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 250 }); } catch (error) { console.error(`❌ Suppression session impossible [${state.id}] :`, error.message); } await fs.promises.mkdir(dir, { recursive: true }); }
function clearSessionMemory(state) {
    state.connected = false;
    state.qr = null;
    state.qrText = null;
    state.contacts.clear();
    state.pendingLidContacts.clear();
    state.lidToPhone.clear();
    state.contactsLoading = false;
    state.initialSyncDone = false;
    state.initialAutoRefreshAttempted = false;
    state.refreshPromise = null;
    state.lastRefreshAt = 0;
    state.lastConnectionError = null;
    state.sendQueue = Promise.resolve();
    state.sendQueueLength = 0;
    state.lastSendAt = 0;
}
async function resetSessionForNewLogin(state, restart = true) {
    if (state.resetPromise) return state.resetPromise;
    state.resetPromise = (async () => {
        if (state.reconnectTimer) {
            clearTimeout(state.reconnectTimer);
            state.reconnectTimer = null;
        }
        // Invalidate all listeners from the previous WhatsApp account before
        // wiping credentials and contact caches.
        state.generation += 1;
        await destroySocket(state);
        await clearAuth(state);
        clearSessionMemory(state);
        console.log(`🧹 Session WhatsApp entièrement réinitialisée [${state.id}]`);
        if (restart && !shuttingDown) {
            await sleep(300);
            startSession(state).catch(error => console.error(`❌ Redémarrage session propre [${state.id}] :`, error));
        }
    })();
    try {
        return await state.resetPromise;
    } finally {
        state.resetPromise = null;
    }
}
function enqueueSend(state, task) { state.sendQueueLength++; const run = state.sendQueue.then(async () => { if (state.lastSendAt) { const wait = SEND_INTERVAL_MS - (Date.now() - state.lastSendAt); if (wait > 0) await sleep(wait); } try { return await task(); } finally { state.lastSendAt = Date.now(); } }); state.sendQueue = run.catch(() => {}); return run.finally(() => { state.sendQueueLength = Math.max(0, state.sendQueueLength - 1); }); }
async function sendText(state, to, message) { if (!state.sock || !state.connected) throw new Error("WhatsApp n'est pas connecté."); const number = normalizeSendNumber(to); if (!number) throw new Error("Numéro de téléphone invalide."); const jid = `${number}@s.whatsapp.net`; return enqueueSend(state, async () => { if (!state.sock || !state.connected) throw new Error("WhatsApp n'est pas connecté."); console.log(`📤 Envoi WhatsApp [${state.id}] → ${number}`); const result = await state.sock.sendMessage(jid, { text: String(message || "") }); const messageId = result?.key?.id || null; if (!messageId) throw new Error("WhatsApp n'a pas retourné d'identifiant de message."); console.log(`✅ Message WhatsApp envoyé [${state.id}] → ${number} (${messageId})`); return { messageId, jid }; }); }
async function applyLidMapping(state, update) {
    const lid = String(update?.lid || "");
    const pn = String(update?.pn || "");
    const number = normalizeNumber(pn);
    if (!isLidJid(lid) || !/^\d{10,15}$/.test(number)) return;
    state.lidToPhone.set(lid, number);

    const pending = state.pendingLidContacts.get(lid);
    if (!pending) return;
    const source = pending._shiftflowSource || "address_book";
    const changed = await upsertContacts(state, [{ ...pending, phoneNumber: number }], source);
    state.pendingLidContacts.delete(lid);
    if (changed > 0) await saveContactsCache(state);
}

async function resolvePendingLids(state) {
    let changed = 0;
    for (const [lid, raw] of Array.from(state.pendingLidContacts.entries())) {
        const number = await resolveLidPhone(state, lid, raw);
        if (!number) continue;
        const source = raw._shiftflowSource || "address_book";
        changed += await upsertContacts(state, [{ ...raw, phoneNumber: number }], source);
        state.pendingLidContacts.delete(lid);
    }
    if (changed > 0) await saveContactsCache(state);
    return changed;
}
function messagePhoneCandidates(msg) {
    const key = msg?.key || {};
    const values = [
        key.remoteJidAlt,
        key.senderPn,
        key.participantPn,
        key.participantAlt,
        msg?.remoteJidAlt,
        msg?.senderPn,
        msg?.participantPn,
        msg?.participantAlt
    ];
    return values
        .map(value => normalizeNumber(value))
        .filter(number => /^\d{10,15}$/.test(number));
}

async function applyMessageContact(state, msg) {
    const key = msg?.key || {};
    const remoteJid = String(key.remoteJid || '');
    const remoteJidAlt = String(key.remoteJidAlt || '');
    const pushName = String(msg?.pushName || '').trim();
    const lid = [remoteJid, String(key.participant || ''), String(key.senderLid || '')].find(isLidJid) || '';
    let number = messagePhoneCandidates(msg)[0] || '';

    // Some Baileys/WhatsApp payloads omit remoteJidAlt but expose the PN
    // through another *_pn/participantAlt field. If none is present, use
    // the existing local LID mapping as a last resort.
    if (!number && lid) number = await resolveLidPhone(state, lid, { phoneNumber: remoteJidAlt });
    if (!number && isPersonJid(remoteJid)) number = normalizeNumber(remoteJid);
    if (!/^\d{10,15}$/.test(number)) return 0;

    if (lid) state.lidToPhone.set(lid, number);

    // Incoming messages can give us a real display name. Do not use the
    // logged-in user's own pushName on fromMe messages.
    if (!key.fromMe && pushName && !looksLikePhoneName(pushName)) {
        const changed = await upsertContacts(state, [{ id: lid || `${number}@s.whatsapp.net`, name: pushName, phoneNumber: number }]);
        if (changed > 0) await saveContactsCache(state);
        if (lid) state.pendingLidContacts.delete(lid);
        return changed;
    }

    // Even on fromMe messages, keep the LID↔PN mapping so a later
    // contacts/chats event can resolve the same person without a full sync.
    if (lid) {
        const pending = state.pendingLidContacts.get(lid);
        if (pending) {
            const changed = await upsertContacts(state, [{ ...pending, phoneNumber: number }]);
            state.pendingLidContacts.delete(lid);
            if (changed > 0) await saveContactsCache(state);
            return changed;
        }
    }
    return 0;
}

async function applyChatContact(state, chat) {
    if (!chat) return 0;
    const id = String(chat.id || '');
    if (!isPersonJid(id) && !isLidJid(id)) return 0;
    const name = contactName(chat) || String(chat.name || chat.notify || chat.pushName || '').trim();
    if (!name || looksLikePhoneName(name)) return 0;
    let number = isPersonJid(id) ? normalizeNumber(id.split('@')[0]) : await resolveLidPhone(state, id, chat);
    if (!/^\d{10,15}$/.test(number)) {
        state.pendingLidContacts.set(id, { ...chat, id, name });
        return 0;
    }
    const changed = await upsertContacts(state, [{ id, name, phoneNumber: number }]);
    if (changed > 0) await saveContactsCache(state);
    return changed;
}

async function startSession(state) { if (shuttingDown || state.starting || state.sock) return; state.starting = true; state.generation += 1; const generation = state.generation; try { const dir = sessionPath(state.id); await fs.promises.mkdir(dir, { recursive: true }); const existingAuth = hasAuthFiles(state); console.log(`${existingAuth ? "🔐 SESSION EXISTANTE" : "🆕 AUCUNE SESSION"} [${state.id}] → ${dir}`); console.log(`🔄 Initialisation Baileys [${state.id}]...`); const { state: authState, saveCreds } = await useMultiFileAuthState(dir); const sock = makeWASocket({ auth: authState, printQRInTerminal: false, browser: ["ShiftFlow", "Chrome", "1.0.0"], markOnlineOnConnect: false, syncFullHistory: false, connectTimeoutMs: 60000, defaultQueryTimeoutMs: 60000, keepAliveIntervalMs: 30000 }); state.sock = sock; state.lastConnectionError = null; sock.ev.on("creds.update", async () => { if (generation !== state.generation) return; await saveCreds(); }); sock.ev.on("connection.update", async update => { if (generation !== state.generation) return; const { connection, qr, lastDisconnect } = update; if (qr) { state.connected = false; state.initialSyncDone = false; await generateQR(state, qr); } if (connection === "open") { state.connected = true; state.qr = null; state.qrText = null; state.initialSyncDone = true; state.lastConnectionError = null; await resolvePendingLids(state); console.log(`✅ WHATSAPP CONNECTÉ [${state.id}]`); } if (connection === "close") { state.connected = false; const code = statusCodeFrom(lastDisconnect?.error); state.lastConnectionError = code ?? null; console.log(`❌ CONNEXION WHATSAPP FERMÉE [${state.id}] — code ${code ?? "inconnu"}`); if (code === DisconnectReason.loggedOut) { console.log(`🚪 Logout réel détecté → réinitialisation complète [${state.id}]`); await resetSessionForNewLogin(state, true); return; } if (!shuttingDown && generation === state.generation) { if (state.reconnectTimer) clearTimeout(state.reconnectTimer); state.reconnectTimer = setTimeout(async () => { state.reconnectTimer = null; await destroySocket(state); if (!shuttingDown) startSession(state).catch(error => console.error(`❌ Reconnexion [${state.id}] :`, error)); }, 3000); console.log(`🔄 Reconnexion automatique dans 3 secondes... [${state.id}]`); } } }); sock.ev.on("lid-mapping.update", async update => {
    if (generation !== state.generation) return;
    await applyLidMapping(state, update);
});

sock.ev.on("contacts.upsert", async list => {
    if (generation !== state.generation) return;
    const changed = await upsertContacts(state, Array.isArray(list) ? list : [], "address_book");
    if (changed > 0) await saveContactsCache(state);
    await resolvePendingLids(state);
});

// contacts.update is also emitted for message push-names. It must never create
// a new contact, otherwise every conversation can leak into the address book.
// Saved-contact changes are delivered again through contacts.upsert/app-state sync.
sock.ev.on("contacts.update", async () => {
    if (generation !== state.generation) return;
});

console.log(`✅ Socket Baileys créé [${state.id}].`); } catch (error) { state.connected = false; state.sock = null; console.error(`❌ Erreur initialisation Baileys [${state.id}] :`, error); if (!shuttingDown) setTimeout(() => startSession(state).catch(retryError => console.error(`❌ Nouvelle tentative [${state.id}] :`, retryError)), 3000); } finally { state.starting = false; } }
async function refreshContacts(state) { if (!state.connected || !state.sock) throw new Error("WhatsApp n'est pas connecté."); if (state.refreshPromise) return state.refreshPromise; const now = Date.now(); const elapsed = now - state.lastRefreshAt; if (state.lastRefreshAt && elapsed < REFRESH_COOLDOWN_MS) { const retryAfter = Math.ceil((REFRESH_COOLDOWN_MS - elapsed) / 1000); const error = new Error(`Actualisation disponible dans ${retryAfter}s.`); error.statusCode = 429; error.retryAfter = retryAfter; throw error; } state.lastRefreshAt = now; state.contactsLoading = true; state.refreshPromise = (async () => { const before = state.contacts.size; if (typeof state.sock.resyncAppState === "function") { try { await state.sock.resyncAppState(["critical_unblock_low", "regular"], true); } catch (error) { console.log(`⚠️ Resync contacts incomplet [${state.id}] : ${error.message}`); } } await sleep(3000); await resolvePendingLids(state); await saveContactsCache(state); const after = state.contacts.size; return { count: after, added: Math.max(0, after - before), previousCount: before, refreshedAt: new Date().toISOString() }; })(); try { return await state.refreshPromise; } finally { state.refreshPromise = null; state.contactsLoading = false; } }
function publicStatus(state) { const refreshRemaining = state.lastRefreshAt ? Math.max(0, Math.ceil((REFRESH_COOLDOWN_MS - (Date.now() - state.lastRefreshAt)) / 1000)) : 0; return { connected: state.connected, hasQR: !!state.qr, qr: state.qr, contactCount: state.contacts.size, contactsLoading: state.contactsLoading, contactsLoaded: state.contacts.size > 0, initialSyncDone: state.initialSyncDone, starting: state.starting, sessionId: state.id, lastConnectionError: state.lastConnectionError, sendQueueLength: state.sendQueueLength, refreshCooldown: refreshRemaining }; }
function sessionFromRequest(req) { return safeSessionId(req.header("x-whatsapp-session") || req.query.sessionId || req.body?.sessionId || DEFAULT_SESSION_ID); }
app.get("/status", async (req, res) => { const state = getSession(sessionFromRequest(req)); await loadContactsCache(state); if (!state.sock && !state.starting && !shuttingDown) startSession(state).catch(error => console.error(`❌ Impossible de démarrer [${state.id}] :`, error)); res.json(publicStatus(state)); });
app.get("/contacts", async (req, res) => {
    const state = getSession(sessionFromRequest(req));
    await loadContactsCache(state);
    if (!state.connected) {
        return res.status(400).json({ error: "WhatsApp n'est pas connecté.", ...publicStatus(state) });
    }

    // Some WhatsApp accounts (especially very small address books) do not
    // deliver their contact app-state immediately after QR login. The manual
    // "Actualiser" button already fixes that by calling resyncAppState.
    // Do the same once automatically when the first contacts request is empty.
    if (state.contacts.size === 0 && !state.initialAutoRefreshAttempted) {
        state.initialAutoRefreshAttempted = true;
        try {
            console.log(`🔄 Synchronisation contacts automatique [${state.id}]`);
            await refreshContacts(state);
        } catch (error) {
            console.log(`⚠️ Synchronisation contacts automatique incomplète [${state.id}] : ${error.message}`);
        }
    }

    res.json(sortedContacts(state));
});
app.get("/whatsapp/qr", (req, res) => { const state = getSession(sessionFromRequest(req)); if (!state.qr) return res.status(404).json({ error: "Aucun QR code disponible." }); res.json({ qr: state.qr }); });
app.post("/refresh", async (req, res) => { const state = getSession(sessionFromRequest(req)); try { res.json({ success: true, ...(await refreshContacts(state)) }); } catch (error) { res.status(error.statusCode || 400).json({ success: false, error: error.message, retryAfter: error.retryAfter || 0, ...publicStatus(state) }); } });
app.post("/send", async (req, res) => { const state = getSession(sessionFromRequest(req)); const { to, message } = req.body || {}; if (!message || !String(message).trim()) return res.status(400).json({ error: "Message vide." }); if (!to) return res.status(400).json({ error: "Numéro de téléphone manquant." }); try { res.json({ success: true, ...(await sendText(state, to, message)) }); } catch (error) { console.error(`❌ Envoi WhatsApp échoué [${state.id}] :`, error.message); res.status(400).json({ success: false, error: error.message }); } });
app.get("/send/status", (req, res) => { const state = getSession(sessionFromRequest(req)); res.json({ connected: state.connected, queueLength: state.sendQueueLength, lastSendAt: state.lastSendAt || null }); });
app.post("/session/start", async (req, res) => { const state = getSession(sessionFromRequest(req)); startSession(state).catch(error => console.error(`❌ Erreur démarrage [${state.id}] :`, error)); res.json({ success: true, ...publicStatus(state) }); });
app.post("/session/logout", async (req, res) => { const state = getSession(sessionFromRequest(req)); if (state.sock && state.connected) { try { await state.sock.logout(); } catch (error) { console.log(`⚠️ Logout socket [${state.id}] : ${error.message}`); } } await resetSessionForNewLogin(state, true); res.json({ success: true, reset: true }); });
app.get("/", (req, res) => res.json({ service: "ShiftFlow WhatsApp", provider: "Baileys", status: "ok" }));
async function discoverExistingSessions() { try { const entries = await fs.promises.readdir(SESSION_ROOT, { withFileTypes: true }); return entries.filter(entry => entry.isDirectory()).map(entry => safeSessionId(entry.name)).filter(Boolean); } catch (error) { console.error(`❌ Impossible de lire le dossier des sessions :`, error.message); return []; } }
async function bootstrap() { await fs.promises.mkdir(SESSION_ROOT, { recursive: true }); console.log("🚀 SHIFTLOW - WHATSAPP BAILEYS SERVICE"); console.log(`📁 Sessions persistantes : ${SESSION_ROOT}`); console.log(`🌐 Port : ${PORT}`); const defaultDir = sessionPath(DEFAULT_SESSION_ID); if (DEFAULT_SESSION_ID === "default" && fs.existsSync(LEGACY_SESSION_ROOT) && !fs.existsSync(defaultDir)) await fs.promises.rename(LEGACY_SESSION_ROOT, defaultDir).catch(() => {}); const existing = await discoverExistingSessions(); if (existing.length > 0) { console.log(`♻️ Sessions existantes détectées : ${existing.join(", ")}`); for (const id of existing) { const state = getSession(id); await loadContactsCache(state); startSession(state).catch(error => console.error(`❌ Restauration session [${id}] :`, error)); } } else console.log("ℹ️ Aucune session sauvegardée au démarrage. Une session sera créée à la demande via /status."); app.listen(PORT, () => { console.log(`🌐 Serveur lancé sur le port ${PORT}`); startReminderScheduler(); }); }
async function shutdown(signal) { if (shuttingDown) return; shuttingDown = true; console.log(`🛑 Arrêt du service (${signal})...`); if (reminderSchedulerBootstrapTimer) clearTimeout(reminderSchedulerBootstrapTimer); if (reminderSchedulerInterval) clearInterval(reminderSchedulerInterval); for (const state of sessions.values()) { if (state.reconnectTimer) clearTimeout(state.reconnectTimer); await destroySocket(state); } process.exit(0); }
process.on("SIGINT", () => shutdown("SIGINT")); process.on("SIGTERM", () => shutdown("SIGTERM"));
bootstrap().catch(error => { console.error("❌ Échec du démarrage du service WhatsApp :", error); process.exit(1); });
