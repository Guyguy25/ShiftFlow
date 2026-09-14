const Module = require("module");

const SEND_INTERVAL_MS = Math.max(
    500,
    Number(process.env.WHATSAPP_SEND_INTERVAL_MS || 1200)
);

const sockets = new Map();
const queues = new Map();
const authStateToSession = new WeakMap();

let capturedApp = null;
let routeInstalled = false;

function safeSessionId(value) {
    return String(value || "default")
        .trim()
        .replace(/[^a-zA-Z0-9_-]/g, "_") || "default";
}

function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(value) {
    let digits = String(value || "")
        .replace(/@s\.whatsapp\.net/g, "")
        .replace(/@c\.us/g, "")
        .replace(/@lid/g, "")
        .replace(/\D/g, "");

    if (digits.startsWith("00")) digits = digits.slice(2);
    if (digits.startsWith("0")) digits = `33${digits.slice(1)}`;

    return digits;
}

function toJid(value) {
    const digits = normalizePhone(value);

    if (!digits || digits.length < 8) {
        throw new Error("Numéro WhatsApp invalide");
    }

    return `${digits}@s.whatsapp.net`;
}

function enqueue(sessionId, task) {
    const id = safeSessionId(sessionId);
    const previous = queues.get(id) || Promise.resolve();

    const next = previous
        .catch(() => undefined)
        .then(async () => {
            const result = await task();
            await sleep(SEND_INTERVAL_MS);
            return result;
        });

    queues.set(id, next);

    next.finally(() => {
        if (queues.get(id) === next) {
            queues.delete(id);
        }
    }).catch(() => undefined);

    return next;
}

const originalLoad = Module._load;

Module._load = function(request, parent, isMain) {
    const loaded = originalLoad.apply(this, arguments);

    if (request === "express" && !loaded.__shiftflowExpressBridge) {
        function expressWrapper(...args) {
            const app = loaded(...args);
            capturedApp = app;
            return app;
        }

        Object.setPrototypeOf(expressWrapper, loaded);
        Object.keys(loaded).forEach((key) => {
            try {
                expressWrapper[key] = loaded[key];
            } catch (_) {}
        });

        expressWrapper.__shiftflowExpressBridge = true;
        return expressWrapper;
    }

    if (request === "@whiskeysockets/baileys" && !loaded.__shiftflowBaileysBridge) {
        const originalMakeWASocket = loaded.default;
        const originalUseMultiFileAuthState = loaded.useMultiFileAuthState;

        if (typeof originalMakeWASocket === "function") {
            loaded.default = function(options) {
                const sock = originalMakeWASocket(options);
                const sessionId = safeSessionId(
                    authStateToSession.get(options?.auth) || "default"
                );

                sockets.set(sessionId, sock);

                if (sock?.ev?.on) {
                    sock.ev.on("connection.update", (update) => {
                        if (
                            update?.connection === "close" &&
                            sockets.get(sessionId) === sock
                        ) {
                            sockets.delete(sessionId);
                        }
                    });
                }

                return sock;
            };
        }

        if (typeof originalUseMultiFileAuthState === "function") {
            loaded.useMultiFileAuthState = async function(dir) {
                const result = await originalUseMultiFileAuthState(dir);
                const normalized = String(dir).replace(/\\/g, "/");
                const match = normalized.match(/whatsapp-sessions\/([^/]+)$/);

                if (match && result?.state) {
                    authStateToSession.set(
                        result.state,
                        safeSessionId(match[1])
                    );
                }

                return result;
            };
        }

        loaded.__shiftflowBaileysBridge = true;
    }

    return loaded;
};

function installSendRoute() {
    if (!capturedApp || routeInstalled) return;

    capturedApp.post("/send", async (req, res) => {
        const sessionId = safeSessionId(
            req.header("x-whatsapp-session") || req.body?.sessionId
        );
        const to = req.body?.to;
        const message = String(req.body?.message || "");

        if (!to || !message) {
            return res.status(400).json({
                error: "to et message sont obligatoires"
            });
        }

        try {
            const result = await enqueue(sessionId, async () => {
                const sock = sockets.get(sessionId);

                if (!sock) {
                    throw new Error(
                        `Session WhatsApp introuvable ou déconnectée: ${sessionId}`
                    );
                }

                if (!sock.user) {
                    throw new Error(
                        `Session WhatsApp non connectée: ${sessionId}`
                    );
                }

                const jid = toJid(to);
                const sent = await sock.sendMessage(jid, {
                    text: message
                });

                return {
                    ok: true,
                    sessionId,
                    to: jid,
                    messageId: sent?.key?.id || null
                };
            });

            return res.json(result);
        } catch (error) {
            console.error(
                `❌ WhatsApp send [${sessionId}] -> ${to}:`,
                error.message
            );

            return res.status(502).json({
                ok: false,
                error: error.message
            });
        }
    });

    capturedApp.get("/send/status", (_req, res) => {
        res.json({
            ok: true,
            interval_ms: SEND_INTERVAL_MS,
            sessions: Array.from(sockets.keys())
        });
    });

    routeInstalled = true;

    console.log(
        `📨 Route WhatsApp /send installée — intervalle minimum ${SEND_INTERVAL_MS} ms`
    );
}

// Le bridge est chargé avant whatsapp_service.js. On attend donc que
// son code d'initialisation ait créé l'app Express avant d'ajouter /send.
process.nextTick(() => {
    installSendRoute();
});

console.log(
    `🔌 ShiftFlow WhatsApp send bridge chargé — délai minimum ${SEND_INTERVAL_MS} ms`
);
