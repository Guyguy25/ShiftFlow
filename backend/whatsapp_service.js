const express = require("express");
const QRCode = require("qrcode");
const qrcode = require("qrcode-terminal");

const makeWASocket = require("@whiskeysockets/baileys").default;

const {
    DisconnectReason,
    useMultiFileAuthState,
} = require("@whiskeysockets/baileys");

const { Boom } = require("@hapi/boom");

const path = require("path");
const fs = require("fs");


// ============================================================
// CONFIGURATION
// ============================================================

const app = express();

const PORT = Number(
    process.env.WHATSAPP_PORT || 3001
);

const SESSION_ROOT = path.join(
    __dirname,
    "whatsapp-sessions"
);

const LEGACY_SESSION_ROOT = path.join(
    __dirname,
    "whatsapp-session"
);

const DEFAULT_SESSION_ID =
    process.env.WHATSAPP_SESSION_ID ||
    "default";


// ============================================================
// MIDDLEWARE
// ============================================================

app.use(
    express.json()
);


// ============================================================
// ÉTAT GLOBAL
// ============================================================

const sessions = new Map();

let shuttingDown = false;


// ============================================================
// UTILITAIRES
// ============================================================

function sleep(ms) {
    return new Promise(
        (resolve) => setTimeout(resolve, ms)
    );
}


function safeSessionId(value) {

    const raw =
        String(
            value ||
            DEFAULT_SESSION_ID
        ).trim();


    const safe =
        raw.replace(
            /[^a-zA-Z0-9_-]/g,
            "_"
        );


    return (
        safe ||
        "default"
    );

}


function sessionPath(sessionId) {

    return path.join(
        SESSION_ROOT,
        safeSessionId(sessionId)
    );

}


// ============================================================
// CRÉATION D'UNE SESSION
// ============================================================

function createSessionState(sessionId) {

    return {

        id:
            safeSessionId(
                sessionId
            ),

        sock:
            null,

        connected:
            false,

        qr:
            null,

        qrText:
            null,

        contacts:
            new Map(),

        contactsLoading:
            false,

        initialSyncDone:
            false,

        starting:
            false,

        reconnectTimer:
            null,

        refreshPromise:
            null,

        generation:
            0,

        lastConnectionError:
            null,

    };

}


// ============================================================
// RÉCUPÉRER UNE SESSION
// ============================================================

function getSession(sessionId) {

    const id =
        safeSessionId(
            sessionId
        );


    let state =
        sessions.get(id);


    if (!state) {

        state =
            createSessionState(
                id
            );


        sessions.set(
            id,
            state
        );

    }


    return state;

}


// ============================================================
// NORMALISER NUMÉRO
// ============================================================

function normalizeNumber(value) {

    return String(
        value || ""
    )
        .replace(
            /@s\.whatsapp\.net/g,
            ""
        )
        .replace(
            /@c\.us/g,
            ""
        )
        .replace(
            /@lid/g,
            ""
        )
        .replace(
            /\D/g,
            ""
        );

}


// ============================================================
// VÉRIFIER JID PERSONNE
// ============================================================

function isPersonJid(jid) {

    const value =
        String(
            jid || ""
        );


    return (

        value.endsWith(
            "@s.whatsapp.net"
        )

        ||

        value.endsWith(
            "@lid"
        )

    );

}


// ============================================================
// NOM CONTACT
// ============================================================

function contactName(contact) {

    return String(

        contact?.name ||

        contact?.shortName ||

        ""

    ).trim();

}


// ============================================================
// NORMALISER CONTACT
// ============================================================

function normalizeContact(contact) {

    if (!contact) {

        return null;

    }


    const id =
        String(
            contact.id ||
            contact.jid ||
            ""
        );


    if (!id) {

        return null;

    }


    if (!isPersonJid(id)) {

        return null;

    }


    const number =
        normalizeNumber(

            contact.number ||

            contact.phoneNumber ||

            id.split("@")[0]

        );


    const name =
        contactName(
            contact
        );


    if (!number) {

        return null;

    }


    if (!name) {

        return null;

    }


    return {

        id,

        name,

        number,

    };

}


// ============================================================
// AJOUT / UPDATE CONTACTS
// ============================================================

function upsertContacts(
    state,
    list
) {

    if (!Array.isArray(list)) {

        return 0;

    }


    let changed = 0;


    for (
        const raw of list
    ) {

        const contact =
            normalizeContact(
                raw
            );


        if (!contact) {

            continue;

        }


        const existing =
            state.contacts.get(
                contact.number
            );


        if (

            !existing

            ||

            existing.id !==
                contact.id

            ||

            existing.name !==
                contact.name

        ) {

            state.contacts.set(
                contact.number,
                contact
            );


            changed++;

        }

    }


    return changed;

}


// ============================================================
// CONTACTS TRIÉS
// ============================================================

function sortedContacts(state) {

    return Array.from(
        state.contacts.values()
    ).sort(

        (a, b) =>

            a.name.localeCompare(
                b.name,
                "fr",
                {
                    sensitivity:
                        "base",
                }
            )

    );

}


// ============================================================
// FICHIER CONTACTS
// ============================================================

function contactsFile(state) {

    return path.join(
        sessionPath(
            state.id
        ),
        "contacts.json"
    );

}


// ============================================================
// CHARGER CACHE CONTACTS
// ============================================================

async function loadContactsCache(
    state
) {

    const file =
        contactsFile(
            state
        );


    try {

        if (
            !fs.existsSync(file)
        ) {

            return;

        }


        const data =
            JSON.parse(

                await fs.promises.readFile(
                    file,
                    "utf8"
                )

            );


        if (
            Array.isArray(data)
        ) {

            upsertContacts(
                state,
                data
            );

        }


        console.log(
            `📂 ${state.contacts.size} contacts cache chargés [${state.id}]`
        );


    } catch (error) {

        console.error(
            `❌ Cache contacts illisible [${state.id}] :`,
            error.message
        );

    }

}


// ============================================================
// SAUVEGARDER CACHE CONTACTS
// ============================================================

async function saveContactsCache(
    state
) {

    try {

        await fs.promises.mkdir(
            sessionPath(
                state.id
            ),
            {
                recursive:
                    true,
            }
        );


        await fs.promises.writeFile(

            contactsFile(
                state
            ),

            JSON.stringify(
                sortedContacts(
                    state
                ),
                null,
                2
            ),

            "utf8"

        );


    } catch (error) {

        console.error(
            `❌ Sauvegarde contacts impossible [${state.id}] :`,
            error.message
        );

    }

}


// ============================================================
// GÉNÉRATION QR
// ============================================================

async function generateQR(
    state,
    qr
) {

    state.qrText =
        qr;


    try {

        state.qr =
            await QRCode.toDataURL(
                qr
            );


    } catch (error) {

        console.error(
            `❌ Erreur génération QR [${state.id}] :`,
            error.message
        );


        state.qr =
            null;

    }


    console.log("");
    console.log(
        `📱 NOUVEAU QR CODE [${state.id}]`
    );
    console.log(
        "────────────────────────────────────"
    );


    try {

        qrcode.generate(
            qr,
            {
                small:
                    true,
            }
        );


    } catch (error) {

        console.error(
            "❌ Impossible d'afficher le QR dans le terminal :",
            error.message
        );

    }


    console.log(
        "────────────────────────────────────"
    );

}


// ============================================================
// CODE DE DÉCONNEXION
// ============================================================

function statusCodeFrom(
    error
) {

    try {

        return new Boom(
            error
        )?.output?.statusCode;


    } catch (_) {

        return undefined;

    }

}


// ============================================================
// DÉTRUIRE SOCKET
// ============================================================

async function destroySocket(
    state
) {

    const old =
        state.sock;


    state.sock =
        null;


    if (!old) {

        return;

    }


    try {

        if (
            typeof old.end ===
            "function"
        ) {

            old.end(
                undefined
            );

        }

    } catch (_) {}


    await sleep(
        250
    );

}


// ============================================================
// SUPPRIMER AUTH SESSION
// ============================================================

async function clearAuth(
    state
) {

    const dir =
        sessionPath(
            state.id
        );


    try {

        await fs.promises.rm(
            dir,
            {
                recursive:
                    true,

                force:
                    true,

                maxRetries:
                    5,

                retryDelay:
                    250,
            }
        );


    } catch (error) {

        console.error(
            `❌ Suppression session impossible [${state.id}] :`,
            error.message
        );

    }


    await fs.promises.mkdir(
        dir,
        {
            recursive:
                true,
        }
    );

}


// ============================================================
// DÉMARRER SESSION
// ============================================================

async function startSession(
    state
) {

    if (
        shuttingDown
    ) {

        return;

    }


    if (
        state.starting
    ) {

        return;

    }


    if (
        state.sock
    ) {

        return;

    }


    state.starting =
        true;


    state.generation +=
        1;


    const generation =
        state.generation;


    try {

        console.log(
            `🔄 Initialisation Baileys [${state.id}]...`
        );


        const dir =
            sessionPath(
                state.id
            );


        await fs.promises.mkdir(
            dir,
            {
                recursive:
                    true,
            }
        );


        const {
            state:
                authState,

            saveCreds,

        } =
            await useMultiFileAuthState(
                dir
            );


        const sock =
            makeWASocket({

                auth:
                    authState,

                printQRInTerminal:
                    false,

                browser: [
                    "ShiftFlow",
                    "Chrome",
                    "1.0.0",
                ],

                markOnlineOnConnect:
                    false,

                syncFullHistory:
                    false,

                connectTimeoutMs:
                    60000,

                defaultQueryTimeoutMs:
                    60000,

                keepAliveIntervalMs:
                    30000,

            });


        state.sock =
            sock;


        state.lastConnectionError =
            null;


        sock.ev.on(
            "creds.update",
            saveCreds
        );


        // ====================================================
        // CONNECTION UPDATE
        // ====================================================

        sock.ev.on(
            "connection.update",
            async (
                update
            ) => {

                if (
                    generation !==
                    state.generation
                ) {

                    return;

                }


                const {
                    connection,
                    qr,
                    lastDisconnect,
                } =
                    update;


                // --------------------------------------------
                // QR
                // --------------------------------------------

                if (qr) {

                    state.connected =
                        false;

                    state.initialSyncDone =
                        false;

                    await generateQR(
                        state,
                        qr
                    );

                }


                // --------------------------------------------
                // OUVERTURE
                // --------------------------------------------

                if (
                    connection ===
                    "open"
                ) {

                    state.connected =
                        true;

                    state.qr =
                        null;

                    state.qrText =
                        null;

                    state.initialSyncDone =
                        true;

                    state.lastConnectionError =
                        null;


                    console.log("");

                    console.log(
                        "────────────────────────────────────"
                    );

                    console.log(
                        `✅ WHATSAPP CONNECTÉ [${state.id}]`
                    );

                    console.log(
                        "────────────────────────────────────"
                    );

                    console.log(
                        `📱 ${state.contacts.size} contacts actuellement en mémoire`
                    );

                }


                // --------------------------------------------
                // FERMETURE
                // --------------------------------------------

                if (
                    connection ===
                    "close"
                ) {

                    state.connected =
                        false;


                    const code =
                        statusCodeFrom(
                            lastDisconnect?.error
                        );


                    state.lastConnectionError =
                        code ??
                        null;


                    console.log("");

                    console.log(
                        `❌ CONNEXION WHATSAPP FERMÉE [${state.id}]`
                    );

                    console.log(
                        `📋 Code : ${code ?? "inconnu"}`
                    );


                    // ========================================
                    // LOGOUT MANUEL WHATSAPP
                    // ========================================

                    if (
                        code ===
                        DisconnectReason.loggedOut
                    ) {

                        console.log(
                            `🚪 Session WhatsApp retirée [${state.id}]`
                        );

                        console.log(
                            "🧹 Cette session uniquement va être réinitialisée."
                        );

                        console.log(
                            "📱 Un nouveau QR code va être généré."
                        );


                        state.connected =
                            false;

                        state.qr =
                            null;

                        state.qrText =
                            null;

                        state.initialSyncDone =
                            false;


                        await destroySocket(
                            state
                        );


                        await clearAuth(
                            state
                        );


                        if (
                            !shuttingDown
                        ) {

                            await sleep(
                                500
                            );


                            startSession(
                                state
                            ).catch(
                                (error) => {

                                    console.error(
                                        `❌ Redémarrage après logout [${state.id}] :`,
                                        error
                                    );

                                }
                            );

                        }


                        return;

                    }


                    // ========================================
                    // AUTRE DÉCONNEXION
                    // ========================================

                    if (
                        !shuttingDown
                        &&
                        generation ===
                            state.generation
                    ) {

                        if (
                            state.reconnectTimer
                        ) {

                            clearTimeout(
                                state.reconnectTimer
                            );

                        }


                        state.reconnectTimer =
                            setTimeout(
                                async () => {

                                    state.reconnectTimer =
                                        null;


                                    await destroySocket(
                                        state
                                    );


                                    if (
                                        !shuttingDown
                                    ) {

                                        startSession(
                                            state
                                        ).catch(
                                            (error) => {

                                                console.error(
                                                    `❌ Reconnexion [${state.id}] :`,
                                                    error
                                                );

                                            }
                                        );

                                    }

                                },
                                3000
                            );


                        console.log(
                            `🔄 Reconnexion automatique dans 3 secondes... [${state.id}]`
                        );

                    }

                }

            }
        );


        // ====================================================
        // CONTACTS.SET
        // ====================================================

        sock.ev.on(
            "contacts.set",
            async (
                event
            ) => {

                const list =
                    event?.contacts ||
                    [];


                const changed =
                    upsertContacts(
                        state,
                        list
                    );


                console.log(
                    `📱 contacts.set [${state.id}] : ${list.length} reçus → ${state.contacts.size} contacts`
                );


                if (
                    changed > 0
                ) {

                    await saveContactsCache(
                        state
                    );

                }

            }
        );


        // ====================================================
        // CONTACTS.UPSERT
        // ====================================================

        sock.ev.on(
            "contacts.upsert",
            async (
                list
            ) => {

                const safeList =
                    Array.isArray(list)
                        ? list
                        : [];


                const changed =
                    upsertContacts(
                        state,
                        safeList
                    );


                console.log(
                    `📱 contacts.upsert [${state.id}] : ${safeList.length} reçus → ${state.contacts.size} contacts`
                );


                if (
                    changed > 0
                ) {

                    await saveContactsCache(
                        state
                    );

                }

            }
        );


        // ====================================================
        // CONTACTS.UPDATE
        // ====================================================

        sock.ev.on(
            "contacts.update",
            async (
                list
            ) => {

                const safeList =
                    Array.isArray(list)
                        ? list
                        : [];


                const changed =
                    upsertContacts(
                        state,
                        safeList
                    );


                console.log(
                    `📱 contacts.update [${state.id}] : ${safeList.length} reçus → ${state.contacts.size} contacts`
                );


                if (
                    changed > 0
                ) {

                    await saveContactsCache(
                        state
                    );

                }

            }
        );


        // ====================================================
        // HISTORY
        // ====================================================

        sock.ev.on(
            "messaging-history.set",
            async (
                event
            ) => {

                const list =
                    event?.contacts ||
                    [];


                if (
                    !Array.isArray(
                        list
                    )
                ) {

                    return;

                }


                const changed =
                    upsertContacts(
                        state,
                        list
                    );


                console.log(
                    `📚 Historique contacts [${state.id}] : ${list.length} reçus → ${state.contacts.size} contacts`
                );


                if (
                    changed > 0
                ) {

                    await saveContactsCache(
                        state
                    );

                }

            }
        );


        console.log(
            `✅ Socket Baileys créé [${state.id}].`
        );


    } catch (error) {

        state.connected =
            false;


        state.sock =
            null;


        state.lastConnectionError =
            null;


        console.error(
            `❌ Erreur initialisation Baileys [${state.id}] :`,
            error
        );


        if (
            !shuttingDown
        ) {

            setTimeout(
                () => {

                    startSession(
                        state
                    ).catch(
                        (retryError) => {

                            console.error(
                                `❌ Erreur nouvelle tentative [${state.id}] :`,
                                retryError
                            );

                        }
                    );

                },
                3000
            );

        }

    } finally {

        state.starting =
            false;

    }

}


// ============================================================
// REFRESH CONTACTS
// ============================================================

async function refreshContacts(
    state
) {

    if (
        !state.connected ||
        !state.sock
    ) {

        throw new Error(
            "WhatsApp n'est pas connecté."
        );

    }


    if (
        state.refreshPromise
    ) {

        return state.refreshPromise;

    }


    state.contactsLoading =
        true;


    state.refreshPromise =
        (async () => {

            console.log("");

            console.log(
                `🔄 Actualisation manuelle des contacts [${state.id}]...`
            );


            const before =
                state.contacts.size;


            // ------------------------------------------------
            // DEMANDER À BAILEYS DE RESYNCHRONISER L'ÉTAT
            // ------------------------------------------------

            if (
                typeof state.sock
                    .resyncAppState ===
                "function"
            ) {

                try {

                    await state.sock.resyncAppState(
                        [
                            "regular",
                        ],
                        true
                    );


                } catch (error) {

                    console.log(
                        `⚠️ Resync contacts incomplet [${state.id}] : ${error.message}`
                    );

                }

            }


            // ------------------------------------------------
            // LAISSER LE TEMPS AUX EVENTS BAILEYS D'ARRIVER
            // ------------------------------------------------

            await sleep(
                3000
            );


            // ------------------------------------------------
            // SAUVEGARDER L'ÉTAT ACTUEL
            // ------------------------------------------------

            await saveContactsCache(
                state
            );


            const after =
                state.contacts.size;


            const added =
                after -
                before;


            console.log(
                `📱 Refresh terminé [${state.id}] : ${after} contacts (${added >= 0 ? "+" : ""}${added})`
            );


            if (
                added === 0
            ) {

                console.log(
                    "ℹ️ Aucun nouveau contact reçu par Baileys pendant ce refresh."
                );

            }


            return {

                count:
                    after,

                added:
                    Math.max(
                        0,
                        added
                    ),

                previousCount:
                    before,

            };

        })();


    try {

        return await state.refreshPromise;

    } finally {

        state.refreshPromise =
            null;

        state.contactsLoading =
            false;

    }

}


// ============================================================
// STATUS PUBLIC
// ============================================================

function publicStatus(
    state
) {

    return {

        connected:
            state.connected,

        hasQR:
            !!state.qr,

        qr:
            state.qr,

        contactCount:
            state.contacts.size,

        contactsLoading:
            state.contactsLoading,

        contactsLoaded:
            state.contacts.size > 0,

        initialSyncDone:
            state.initialSyncDone,

        starting:
            state.starting,

        sessionId:
            state.id,

        lastConnectionError:
            state.lastConnectionError,

    };

}


// ============================================================
// SESSION ID DEPUIS REQUEST
// ============================================================

function sessionFromRequest(
    req
) {

    return safeSessionId(

        req.header(
            "x-whatsapp-session"
        )

        ||

        req.query.sessionId

        ||

        req.body?.sessionId

        ||

        DEFAULT_SESSION_ID

    );

}


// ============================================================
// ROUTE STATUS
// ============================================================

app.get(
    "/status",
    async (
        req,
        res
    ) => {

        const state =
            getSession(
                sessionFromRequest(
                    req
                )
            );


        await loadContactsCache(
            state
        );


        // ----------------------------------------------------
        // IMPORTANT :
        // Si cette session n'existe pas encore, on la démarre.
        // Cela permet à chaque utilisateur/agence d'obtenir
        // automatiquement son propre QR.
        // ----------------------------------------------------

        if (
            !state.sock
            &&
            !state.starting
            &&
            !shuttingDown
        ) {

            startSession(
                state
            ).catch(
                (error) => {

                    console.error(
                        `❌ Impossible de démarrer la session [${state.id}] :`,
                        error
                    );

                }
            );

        }


        res.json(
            publicStatus(
                state
            )
        );

    }
);


// ============================================================
// ROUTE CONTACTS
// ============================================================

app.get(
    "/contacts",
    async (
        req,
        res
    ) => {

        const state =
            getSession(
                sessionFromRequest(
                    req
                )
            );


        await loadContactsCache(
            state
        );


        if (
            !state.connected
        ) {

            return res
                .status(400)
                .json({

                    error:
                        "WhatsApp n'est pas connecté.",

                    ...publicStatus(
                        state
                    ),

                });

        }


        res.json(
            sortedContacts(
                state
            )
        );

    }
);


// ============================================================
// ROUTE QR
// ============================================================

app.get(
    "/whatsapp/qr",
    (
        req,
        res
    ) => {

        const state =
            getSession(
                sessionFromRequest(
                    req
                )
            );


        if (
            !state.qr
        ) {

            return res
                .status(404)
                .json({

                    error:
                        "Aucun QR code disponible.",

                });

        }


        res.json({

            qr:
                state.qr,

        });

    }
);


// ============================================================
// ROUTE REFRESH
// ============================================================

app.post(
    "/refresh",
    async (
        req,
        res
    ) => {

        const state =
            getSession(
                sessionFromRequest(
                    req
                )
            );


        try {

            const result =
                await refreshContacts(
                    state
                );


            res.json({

                success:
                    true,

                ...result,

            });


        } catch (error) {

            res
                .status(400)
                .json({

                    success:
                        false,

                    error:
                        error.message,

                });

        }

    }
);


// ============================================================
// ROUTE SESSION START
// ============================================================

app.post(
    "/session/start",
    async (
        req,
        res
    ) => {

        const state =
            getSession(
                sessionFromRequest(
                    req
                )
            );


        startSession(
            state
        ).catch(
            (error) => {

                console.error(
                    `❌ Erreur démarrage session [${state.id}] :`,
                    error
                );

            }
        );


        res.json({

            success:
                true,

            ...publicStatus(
                state
            ),

        });

    }
);


// ============================================================
// ROUTE SESSION LOGOUT
// ============================================================

app.post(
    "/session/logout",
    async (
        req,
        res
    ) => {

        const state =
            getSession(
                sessionFromRequest(
                    req
                )
            );


        if (
            state.reconnectTimer
        ) {

            clearTimeout(
                state.reconnectTimer
            );


            state.reconnectTimer =
                null;

        }


        // ----------------------------------------------------
        // Si une socket existe, on demande à WhatsApp
        // de déconnecter cette session.
        // Le connection.update "loggedOut" se chargera
        // ensuite de nettoyer cette session et de générer
        // un nouveau QR.
        // ----------------------------------------------------

        if (
            state.sock
            &&
            state.connected
        ) {

            try {

                await state.sock.logout();

            } catch (error) {

                console.log(
                    `⚠️ Logout socket [${state.id}] : ${error.message}`
                );

            }

        } else {

            await destroySocket(
                state
            );


            await clearAuth(
                state
            );


            state.connected =
                false;

            state.qr =
                null;

            state.qrText =
                null;

            state.initialSyncDone =
                false;

            state.contacts.clear();


            await sleep(
                500
            );


            if (
                !shuttingDown
            ) {

                startSession(
                    state
                ).catch(
                    (error) => {

                        console.error(
                            `❌ Redémarrage session [${state.id}] :`,
                            error
                        );

                    }
                );

            }

        }


        res.json({

            success:
                true,

        });

    }
);


// ============================================================
// ROUTE ROOT
// ============================================================

app.get(
    "/",
    (
        req,
        res
    ) => {

        res.json({

            service:
                "ShiftFlow WhatsApp",

            provider:
                "Baileys",

            status:
                "ok",

        });

    }
);


// ============================================================
// BOOTSTRAP
// ============================================================

async function bootstrap() {

    await fs.promises.mkdir(
        SESSION_ROOT,
        {
            recursive:
                true,
        }
    );


    console.log("");

    console.log(
        "🚀 SHIFTLOW - WHATSAPP BAILEYS SERVICE"
    );

    console.log(
        "────────────────────────────────────"
    );

    console.log(
        `📁 Sessions : ${SESSION_ROOT}`
    );

    console.log(
        `🌐 Port : ${PORT}`
    );

    console.log(
        "────────────────────────────────────"
    );


    // --------------------------------------------------------
    // COMPATIBILITÉ AVEC L'ANCIEN DOSSIER
    // --------------------------------------------------------

    const defaultDir =
        sessionPath(
            DEFAULT_SESSION_ID
        );


    if (

        DEFAULT_SESSION_ID ===
            "default"

        &&

        fs.existsSync(
            LEGACY_SESSION_ROOT
        )

        &&

        !fs.existsSync(
            defaultDir
        )

    ) {

        await fs.promises.rename(
            LEGACY_SESSION_ROOT,
            defaultDir
        ).catch(
            () => {}
        );

    }


    // --------------------------------------------------------
    // SESSION PAR DÉFAUT
    // --------------------------------------------------------

    const state =
        getSession(
            DEFAULT_SESSION_ID
        );


    await loadContactsCache(
        state
    );


    await startSession(
        state
    );


    // --------------------------------------------------------
    // SERVEUR HTTP
    // --------------------------------------------------------

    app.listen(
        PORT,
        () => {

            console.log("");

            console.log(
                `🌐 Serveur lancé sur le port ${PORT}`
            );

            console.log(
                `👉 http://localhost:${PORT}`
            );

            console.log("");

        }
    );

}


// ============================================================
// ARRÊT PROPRE
// ============================================================

async function shutdown(
    signal
) {

    if (
        shuttingDown
    ) {

        return;

    }


    shuttingDown =
        true;


    console.log("");

    console.log(
        `🛑 Arrêt du service (${signal})...`
    );


    for (
        const state of
            sessions.values()
    ) {

        if (
            state.reconnectTimer
        ) {

            clearTimeout(
                state.reconnectTimer
            );

        }


        await destroySocket(
            state
        );

    }


    process.exit(
        0
    );

}


// ============================================================
// SIGNALS
// ============================================================

process.on(
    "SIGINT",
    () => shutdown(
        "SIGINT"
    )
);


process.on(
    "SIGTERM",
    () => shutdown(
        "SIGTERM"
    )
);


// ============================================================
// START
// ============================================================

bootstrap().catch(
    (error) => {

        console.error(
            "❌ Erreur fatale :",
            error
        );


        process.exit(
            1
        );

    }
);