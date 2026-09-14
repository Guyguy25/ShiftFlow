const Module = require("module");
const express = require("express");

const SEND_PORT = Number(process.env.WHATSAPP_SEND_PORT || 3002);
const SEND_INTERVAL_MS = Math.max(500, Number(process.env.WHATSAPP_SEND_INTERVAL_MS || 1200));

const socketBySession = new Map();
const sessionQueues = new Map();
const authStateSessionIds = new WeakMap();

function safeSessionId(value) {
    return String(value || "default").trim().replace(/[^a-zA-Z0-9_-]/g, "_") || "default";
}

function normalizePhone(value) {
    let digits = String(value || "")
        .replace(/@s\.whatsapp\.net/g, "")
        .replace(/@c\.us/g, "")
        .replace(/@lid/g, "")
        .replace(/\D/g, "");

    if (digits.startsWith("0")) digits = `33${digits.slice(1)}`;
    if (digits.startsWith("00")) digits = digits.slice(2);
    return digits;
}

function jidFor(value) {
    const digits = normalizePhone(value);
    if (!digits) throw new Error("Numéro WhatsApp invalide");
    return `${digits}@s.whatsapp.net`;
}

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function enqueue(sessionId, task) {
    const id = safeSessionId(sessionId);
    const previous = sessionQueues.get(id) || Promise.resolve();
    const next = previous
        .catch(() => {})
        .then(async () => {
            const result = await task();
            await sleep(SEND_INTERVAL_MS);
            return result;
        });

    sessionQueues.set(id, next);
    next.finally(() => {
        if (sessionQueues.get(id) === next) sessionQueues.delete(id);
    }).catch(() => {});
    return next;
}

const originalLoad = Module._load;
Module._load = function patchedLoad(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);

    if (request !== "@whiskeysockets/baileys" || loaded.__shiftflowPatched) {
        return loaded;
    }

    const wrapped = { ...loaded };
    const originalMakeWASocket = loaded.default;
    const originalUseMultiFileAuthState = loaded.useMultiFileAuthState;

    wrapped.useMultiFileAuthState = async function patchedAuthState(dir) {
        const result = await originalUseMultiFileAuthState(dir);
        const normalized = String(dir).replace(/\\/g, "/");
        const match = normalized.match(/whatsapp-sessions\/([^/]+)$/);
        if (match) authStateSessionIds.set(result.state, safeSessionId(match[1]));
        return result;
    };

    wrapped.default = function patchedMakeWASocket(options) {
        const sock = originalMakeWASocket(options);
        const sessionId = authStateSessionIds.get(options?.auth) || "default";
        socketBySession.set(sessionId, sock);

        const originalEnd = sock.end?.bind(sock);
        if (originalEnd) {
            sock.end = (...args) => {
                const result = originalEnd(...args);
                if (socketBySession.get(sessionId) === sock) socketBySession.delete(sessionId);
                return result;
            };
        }

        return sock;
    };

    wrapped.__shiftflowPatched = true;
    return wrapped;
};

const app = express();
app.use(express.json());

app.get("/", (_req, res) => {
    res.json({ service: "ShiftFlow WhatsApp sender", ok: true, interval_ms: SEND_INTERVAL_MS });
});

app.get("/status", (_req, res) => {
    res.json({ sessions: Array.from(socketBySession.keys()) });
});

app.post("/send", async (req, res) => {
    const sessionId = safeSessionId(req.header("x-whatsapp-session") || req.body?.sessionId);
    const to = req.body?.to;
    const message = String(req.body?.message || "");

    if (!to || !message) {
        return res.status(400).json({ error: "to et message sont obligatoires" });
    }

    return enqueue(sessionId, async () => {
        const sock = socketBySession.get(sessionId);
        if (!sock) throw new Error(`Session WhatsApp introuvable: ${sessionId}`);
        if (!sock.user) throw new Error(`Session WhatsApp non connectée: ${sessionId}`);

        const jid = jidFor(to);
        const result = await sock.sendMessage(jid, { text: message });

        return {
            ok: true,
            sessionId,
            to: jid,
            messageId: result?.key?.id || null,
        };
    }).then(result => res.json(result)).catch(error => {
        console.error(`❌ WhatsApp send [${sessionId}] -> ${to}:`, error.message);
        res.status(502).json({ error: error.message });
    });
});

app.listen(SEND_PORT, () => {
    console.log(`📨 ShiftFlow WhatsApp sender sur le port ${SEND_PORT}`);
    console.log(`⏱️ Intervalle minimum entre messages d'une même session : ${SEND_INTERVAL_MS} ms`);
});
