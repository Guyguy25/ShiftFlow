const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const QRCode = require("qrcode");
const path = require("path");
const fs = require("fs");

const app = express();

const PORT = process.env.WHATSAPP_PORT || 3001;

app.use(express.json());


// ============================================================
// CONFIGURATION
// ============================================================

const SESSION_ROOT = path.join(
    __dirname,
    "whatsapp-session"
);

const MAX_INIT_RETRIES = 3;

const CONTACT_SYNC_TIMEOUT = 45000;
const CONTACT_STABLE_CHECKS = 2;
const CONTACT_STABLE_INTERVAL = 1200;

const LID_BATCH_SIZE = 20;


// ============================================================
// ÉTAT GLOBAL
// ============================================================

let client = null;

let whatsappReady = false;
let currentQR = null;

let contacts = [];

let contactsLoading = false;
let contactsLoadedForSession = false;

let initializing = false;
let reconnecting = false;

let generation = 0;

let currentClientGeneration = 0;


// ============================================================
// GESTION DES ERREURS PUPPETEER / WHATSAPP-WEB.JS
// ============================================================
//
// whatsapp-web.js 1.34.7 peut produire une erreur non interceptée
// pendant un LOGOUT manuel.
//
// Exemple :
//   Attempted to use detached Frame
//   Protocol error (Runtime.callFunctionOn)
//
// Cette erreur arrive parce que whatsapp-web.js continue une
// opération Puppeteer alors que WhatsApp vient de détruire le frame.
//
// On intercepte UNIQUEMENT ces erreurs connues afin d'éviter
// que Node.js entier ne crash.
//

process.on("uncaughtException", (error) => {

    const message =
        error?.message ||
        String(error);


    const isWhatsAppLifecycleError =
        message.includes("Attempted to use detached Frame") ||
        message.includes("Execution context was destroyed") ||
        message.includes("Protocol error") ||
        message.includes("Session closed") ||
        message.includes("Target closed");


    if (!isWhatsAppLifecycleError) {

        console.error(
            "❌ Exception non gérée :",
            error
        );

        return;
    }


    console.log(
        "⚠️ Erreur Chromium/WhatsApp pendant une transition de session."
    );

    console.log(
        `   ${message}`
    );


    // Si une reconnexion n'est pas déjà en cours,
    // on laisse la librairie terminer sa séquence puis
    // on reconstruit le client.
    if (!reconnecting) {

        console.log(
            "🔄 Récupération automatique du client..."
        );


        setTimeout(() => {

            recoverAfterLogout()
                .catch((recoveryError) => {

                    console.error(
                        "❌ Échec récupération WhatsApp :",
                        recoveryError
                    );

                });

        }, 2000);
    }

});


// ============================================================
// LOGS
// ============================================================

console.log("🚀 Initialisation de WhatsApp...");
console.log("────────────────────────────────────");

console.log(
    `📁 Session WhatsApp : ${SESSION_ROOT}`
);

console.log(
    `📁 Session existe : ${fs.existsSync(SESSION_ROOT)}`
);

console.log("────────────────────────────────────");


// ============================================================
// CRÉATION CLIENT
// ============================================================

function createClient() {

    console.log(
        "🚀 Création du client WhatsApp..."
    );


    const newClient = new Client({

        authStrategy: new LocalAuth({

            dataPath: SESSION_ROOT,

            rmMaxRetries: 10,

        }),


        puppeteer: {

            headless: true,

            protocolTimeout: 300000,

            args: [

                "--no-sandbox",
                "--disable-setuid-sandbox",

                "--disable-dev-shm-usage",

                "--disable-gpu",

                "--disable-extensions",

                "--disable-background-networking",

                "--disable-background-timer-throttling",

                "--disable-renderer-backgrounding",

                "--disable-features=Translate,BackForwardCache",

            ],

        },

    });


    const thisGeneration =
        ++generation;


    currentClientGeneration =
        thisGeneration;


    // ========================================================
    // QR
    // ========================================================

    newClient.on(
        "qr",
        async (qr) => {

            // Ignore les anciens clients.

            if (
                thisGeneration !== generation
            ) {
                return;
            }


            try {

                currentQR =
                    await QRCode.toDataURL(qr);


                whatsappReady = false;

                contacts = [];

                contactsLoadedForSession = false;

                contactsLoading = false;


                console.log(
                    "📱 Nouveau QR WhatsApp disponible"
                );


            } catch (error) {

                console.error(
                    "❌ Erreur génération QR :",
                    error
                );


                currentQR = null;

            }

        }
    );


    // ========================================================
    // AUTHENTIFICATION
    // ========================================================

    newClient.on(
        "authenticated",
        () => {

            if (
                thisGeneration !== generation
            ) {
                return;
            }


            console.log(
                "🔐 WhatsApp authentifié"
            );

        }
    );


    // ========================================================
    // AUTH FAILURE
    // ========================================================

    newClient.on(
        "auth_failure",
        (message) => {

            if (
                thisGeneration !== generation
            ) {
                return;
            }


            console.error(
                "❌ Échec authentification WhatsApp :",
                message
            );


            whatsappReady = false;

            currentQR = null;

            contacts = [];

            contactsLoadedForSession = false;

            contactsLoading = false;

        }
    );


    // ========================================================
    // READY
    // ========================================================

    newClient.on(
        "ready",
        async () => {

            // ------------------------------------------------
            // IGNORER LES ANCIENS CLIENTS
            // ------------------------------------------------

            if (
                thisGeneration !== generation
            ) {

                console.log(
                    "ℹ️ READY provenant d'un ancien client ignoré."
                );

                return;
            }


            // ------------------------------------------------
            // EMPÊCHER DOUBLE READY
            // ------------------------------------------------

            if (
                whatsappReady &&
                contactsLoading
            ) {

                console.log(
                    "ℹ️ READY déjà en cours, événement ignoré."
                );

                return;
            }


            console.log(
                "✅ WhatsApp connecté"
            );


            whatsappReady = true;

            currentQR = null;


            // On ne recharge pas inutilement les contacts
            // si cette session les possède déjà.

            if (
                contactsLoadedForSession
            ) {

                console.log(
                    "ℹ️ Contacts déjà chargés pour cette session."
                );

                return;
            }


            if (
                contactsLoading
            ) {

                return;
            }


            contactsLoading = true;


            try {

                console.log(
                    "⏳ Synchronisation des contacts..."
                );


                // ------------------------------------------------
                // ATTENTE SYNCHRONISATION
                // ------------------------------------------------

                await waitForContactSync(
                    newClient,
                    thisGeneration
                );


                if (
                    !whatsappReady ||
                    thisGeneration !== generation
                ) {

                    throw new Error(
                        "WhatsApp déconnecté pendant la synchronisation"
                    );
                }


                // ------------------------------------------------
                // RÉCUPÉRATION
                // ------------------------------------------------

                console.log(
                    "⏳ Récupération des contacts..."
                );


                await loadContacts(
                    newClient,
                    thisGeneration
                );


                if (
                    !whatsappReady ||
                    thisGeneration !== generation
                ) {

                    throw new Error(
                        "WhatsApp déconnecté pendant la récupération"
                    );
                }


                contactsLoadedForSession =
                    true;


                console.log(
                    `✅ Synchronisation terminée : ${contacts.length} contacts`
                );


            } catch (error) {

                console.error(
                    "❌ Erreur récupération contacts :",
                    error
                );


            } finally {

                if (
                    thisGeneration === generation
                ) {

                    contactsLoading = false;

                }

            }

        }
    );


    // ========================================================
    // DISCONNECTED
    // ========================================================

    newClient.on(
        "disconnected",
        (reason) => {

            console.log(
                "❌ WhatsApp déconnecté :",
                reason
            );


            whatsappReady = false;

            currentQR = null;

            contacts = [];

            contactsLoadedForSession = false;

            contactsLoading = false;


            // ------------------------------------------------
            // LOGOUT MANUEL
            // ------------------------------------------------

            if (
                String(reason).toUpperCase() === "LOGOUT"
            ) {

                console.log(
                    "🔄 Déconnexion manuelle détectée."
                );


                if (
                    !reconnecting
                ) {

                    reconnecting = true;


                    // IMPORTANT :
                    //
                    // NE PAS fermer Chromium ici.
                    //
                    // whatsapp-web.js est encore en train
                    // de gérer son propre LOGOUT.
                    //
                    // On attend qu'il termine sa transition.

                    setTimeout(() => {

                        recoverAfterLogout()
                            .catch((error) => {

                                console.error(
                                    "❌ Erreur reconnexion après logout :",
                                    error
                                );

                            })
                            .finally(() => {

                                reconnecting =
                                    false;

                            });

                    }, 3500);

                }


                return;
            }


            // ------------------------------------------------
            // AUTRE DÉCONNEXION
            // ------------------------------------------------

            console.log(
                "⚠️ Déconnexion non-LOGOUT."
            );

        }
    );


    // ========================================================
    // ERREUR
    // ========================================================

    newClient.on(
        "error",
        (error) => {

            console.error(
                "❌ Erreur WhatsApp :",
                error
            );

        }
    );


    return newClient;
}


// ============================================================
// INITIALISATION
// ============================================================

async function initializeWhatsApp() {

    if (
        initializing
    ) {

        console.log(
            "ℹ️ Initialisation déjà en cours."
        );

        return;
    }


    initializing = true;


    for (
        let attempt = 1;
        attempt <= MAX_INIT_RETRIES;
        attempt++
    ) {

        try {

            console.log(
                `🔄 Tentative d'initialisation ${attempt}/${MAX_INIT_RETRIES}`
            );


            client =
                createClient();


            await client.initialize();


            console.log(
                "✅ Initialisation WhatsApp terminée"
            );


            initializing =
                false;


            return;


        } catch (error) {

            console.error(
                `❌ Échec initialisation ${attempt}/${MAX_INIT_RETRIES} :`,
                error
            );


            whatsappReady = false;

            currentQR = null;

            contacts = [];


            const failedClient =
                client;


            client = null;


            await safeDestroyClient(
                failedClient
            );


            if (
                attempt < MAX_INIT_RETRIES
            ) {

                console.log(
                    "⏳ Nouvelle tentative dans 2 secondes..."
                );


                await sleep(2000);

            }

        }

    }


    initializing =
        false;


    console.error(
        "❌ Impossible d'initialiser WhatsApp après plusieurs tentatives."
    );

}


// ============================================================
// RÉCUPÉRATION APRÈS LOGOUT
// ============================================================

async function recoverAfterLogout() {

    if (
        initializing
    ) {

        console.log(
            "ℹ️ Initialisation déjà en cours, récupération ignorée."
        );

        return;
    }


    if (
        !reconnecting
    ) {

        reconnecting =
            true;

    }


    console.log(
        "🔄 Redémarrage automatique du client WhatsApp..."
    );


    whatsappReady =
        false;

    currentQR =
        null;

    contacts =
        [];

    contactsLoadedForSession =
        false;

    contactsLoading =
        false;


    // Invalide les opérations de l'ancien client.

    generation++;


    const oldClient =
        client;


    client =
        null;


    // --------------------------------------------------------
    // IMPORTANT
    // --------------------------------------------------------
    //
    // On attend d'abord la fin de la séquence interne
    // de whatsapp-web.js.
    //
    // Puis seulement on détruit le navigateur.
    //

    await sleep(1500);


    await safeDestroyClient(
        oldClient
    );


    // --------------------------------------------------------
    // SESSION
    // --------------------------------------------------------

    await removeSessionFolder();


    // --------------------------------------------------------
    // NOUVEAU CLIENT
    // --------------------------------------------------------

    try {

        await initializeWhatsApp();

    } finally {

        reconnecting =
            false;

    }

}


// ============================================================
// DESTRUCTION SAFE DU CLIENT
// ============================================================

async function safeDestroyClient(
    targetClient
) {

    if (
        !targetClient
    ) {

        return;
    }


    console.log(
        "🧹 Fermeture de l'ancien client WhatsApp..."
    );


    try {

        if (
            typeof targetClient.destroy ===
            "function"
        ) {

            await Promise.race([

                targetClient
                    .destroy()
                    .catch(() => {}),

                sleep(5000),

            ]);

        }

    } catch (error) {

        console.log(
            "⚠️ Erreur pendant destruction client :",
            error.message
        );

    }


    // --------------------------------------------------------
    // Sécurité : navigateur Puppeteer
    // --------------------------------------------------------

    try {

        if (
            targetClient.pupBrowser
        ) {

            if (
                targetClient.pupBrowser.isConnected()
            ) {

                await targetClient
                    .pupBrowser
                    .close()
                    .catch(() => {});

            }

        }

    } catch (error) {

        console.log(
            "⚠️ Erreur fermeture Chromium :",
            error.message
        );

    }


    await sleep(1000);


    console.log(
        "✅ Ancien client fermé"
    );

}


// ============================================================
// NETTOYAGE SESSION
// ============================================================

async function removeSessionFolder() {

    if (
        !fs.existsSync(SESSION_ROOT)
    ) {

        return true;
    }


    console.log(
        "🧹 Nettoyage de l'ancienne session..."
    );


    const MAX_ATTEMPTS =
        10;


    for (
        let attempt = 1;
        attempt <= MAX_ATTEMPTS;
        attempt++
    ) {

        try {

            await fs.promises.rm(
                SESSION_ROOT,
                {
                    recursive: true,
                    force: true,
                    maxRetries: 3,
                    retryDelay: 500,
                }
            );


            console.log(
                "✅ Ancienne session supprimée"
            );


            return true;


        } catch (error) {

            if (
                error.code === "EBUSY" ||
                error.code === "EPERM" ||
                error.code === "ENOTEMPTY"
            ) {

                console.log(
                    `⏳ Session encore verrouillée, nouvelle tentative ${attempt}/${MAX_ATTEMPTS}...`
                );


                await sleep(1000);


                continue;

            }


            console.error(
                "❌ Erreur suppression session :",
                error
            );


            return false;

        }

    }


    console.log(
        "⚠️ Session toujours verrouillée."
    );


    console.log(
        "ℹ️ Le prochain cycle tentera automatiquement de la nettoyer."
    );


    return false;
}


// ============================================================
// SYNCHRONISATION CONTACTS
// ============================================================

async function waitForContactSync(
    targetClient,
    currentGeneration
) {

    const start =
        Date.now();


    let previousCount =
        -1;


    let stableCount =
        0;


    while (
        Date.now() - start <
        CONTACT_SYNC_TIMEOUT
    ) {

        if (
            !whatsappReady ||
            currentGeneration !== generation
        ) {

            throw new Error(
                "WhatsApp déconnecté pendant la synchronisation"
            );

        }


        try {

            const allContacts =
                await targetClient
                    .getContacts();


            const count =
                allContacts.length;


            console.log(
                `📦 Synchronisation : ${count} entrées WhatsApp`
            );


            if (
                count > 0 &&
                count === previousCount
            ) {

                stableCount++;

            } else {

                stableCount = 0;

            }


            previousCount =
                count;


            if (
                stableCount >=
                CONTACT_STABLE_CHECKS
            ) {

                console.log(
                    "✅ Nombre de contacts stabilisé"
                );


                return;

            }


        } catch (error) {

            if (
                !whatsappReady ||
                currentGeneration !== generation
            ) {

                throw new Error(
                    "WhatsApp déconnecté pendant la synchronisation"
                );

            }


            console.log(
                "⚠️ Synchronisation encore en cours..."
            );

        }


        await sleep(
            CONTACT_STABLE_INTERVAL
        );

    }


    console.log(
        "⚠️ Timeout synchronisation, récupération des contacts disponibles."
    );

}


// ============================================================
// CHARGEMENT CONTACTS
// ============================================================

async function loadContacts(
    targetClient,
    currentGeneration
) {

    const allContacts =
        await targetClient
            .getContacts();


    console.log(
        `📦 ${allContacts.length} entrées reçues`
    );


    const contactsByNumber =
        new Map();


    const lidContacts =
        [];


    // ========================================================
    // PREMIER PASS
    // ========================================================

    for (
        const contact of allContacts
    ) {

        if (
            !whatsappReady ||
            currentGeneration !== generation
        ) {

            throw new Error(
                "WhatsApp déconnecté pendant la récupération"
            );

        }


        if (
            contact.isGroup
        ) {

            continue;

        }


        if (
            !contact.isWAContact
        ) {

            continue;

        }


        if (
            !contact.id
        ) {

            continue;

        }


        const serializedId =
            contact.id._serialized ||
            "";


        if (
            !serializedId
        ) {

            continue;

        }


        const name =
            contact.name ||
            contact.pushname ||
            contact.shortName ||
            "";


        if (
            !name.trim()
        ) {

            continue;

        }


        // ====================================================
        // @c.us
        // ====================================================

        if (
            serializedId.endsWith("@c.us")
        ) {

            let number =
                contact.id.user;


            if (
                !number
            ) {

                continue;

            }


            number =
                String(number)
                    .replace(/\D/g, "");


            if (
                !number
            ) {

                continue;

            }


            if (
                !contactsByNumber.has(number)
            ) {

                contactsByNumber.set(
                    number,
                    {
                        id:
                            serializedId,

                        name:
                            name.trim(),

                        number,

                        isMyContact:
                            contact.isMyContact,

                    }
                );

            }


            continue;

        }


        // ====================================================
        // @lid
        // ====================================================

        if (
            serializedId.endsWith("@lid")
        ) {

            lidContacts.push({

                contact,

                serializedId,

                name:
                    name.trim(),

            });

        }

    }


    console.log(
        `📱 ${lidContacts.length} contacts LID à résoudre`
    );


    // ========================================================
    // RÉSOLUTION LID
    // ========================================================

    for (
        let i = 0;
        i < lidContacts.length;
        i += LID_BATCH_SIZE
    ) {

        if (
            !whatsappReady ||
            currentGeneration !== generation
        ) {

            throw new Error(
                "WhatsApp déconnecté pendant la résolution des LID"
            );

        }


        const batch =
            lidContacts.slice(
                i,
                i + LID_BATCH_SIZE
            );


        await Promise.allSettled(

            batch.map(
                async ({
                    contact,
                    serializedId,
                    name,
                }) => {

                    try {

                        const result =
                            await targetClient
                                .getContactLidAndPhone([
                                    serializedId
                                ]);


                        if (
                            !result ||
                            !result.length ||
                            !result[0]?.pn
                        ) {

                            return;

                        }


                        let number =
                            result[0].pn;


                        number =
                            String(number)
                                .replace(
                                    "@c.us",
                                    ""
                                )
                                .replace(
                                    "@s.whatsapp.net",
                                    ""
                                )
                                .replace(
                                    /\D/g,
                                    ""
                                );


                        if (
                            !number
                        ) {

                            return;

                        }


                        if (
                            !contactsByNumber.has(
                                number
                            )
                        ) {

                            contactsByNumber.set(
                                number,
                                {
                                    id:
                                        serializedId,

                                    name,

                                    number,

                                    isMyContact:
                                        contact.isMyContact,

                                }
                            );

                        }


                    } catch (error) {

                        // LID impossible à résoudre :
                        // on ignore ce contact.

                    }

                }
            )

        );

    }


    // ========================================================
    // RÉSULTAT
    // ========================================================

    contacts =
        Array.from(
            contactsByNumber.values()
        );


    console.log(
        `📱 ${contacts.length} vrais contacts récupérés`
    );

}


// ============================================================
// STATUS
// ============================================================

app.get(
    "/status",
    (req, res) => {

        res.json({

            connected:
                whatsappReady,

            hasQR:
                !!currentQR,

            qr:
                currentQR,

            contactCount:
                contacts.length,

            contactsLoading:
                contactsLoading,

            contactsLoaded:
                contactsLoadedForSession,

        });

    }
);


// ============================================================
// CONTACTS
// ============================================================

app.get(
    "/contacts",
    (req, res) => {

        if (
            !whatsappReady
        ) {

            return res.status(400).json({

                error:
                    "WhatsApp n'est pas connecté",

            });

        }


        res.json(
            contacts
        );

    }
);


// ============================================================
// REFRESH CONTACTS
// ============================================================

app.post(
    "/refresh",
    async (req, res) => {

        if (
            !whatsappReady
        ) {

            return res.status(400).json({

                error:
                    "WhatsApp n'est pas connecté",

            });

        }


        if (
            contactsLoading
        ) {

            return res.status(409).json({

                error:
                    "Récupération des contacts déjà en cours",

            });

        }


        contactsLoading =
            true;


        const currentGeneration =
            generation;


        try {

            console.log(
                "🔄 Actualisation manuelle des contacts..."
            );


            await waitForContactSync(
                client,
                currentGeneration
            );


            await loadContacts(
                client,
                currentGeneration
            );


            contactsLoadedForSession =
                true;


            res.json({

                success:
                    true,

                count:
                    contacts.length,

            });


        } catch (error) {

            console.error(
                "❌ Erreur refresh contacts :",
                error
            );


            res.status(500).json({

                success:
                    false,

                error:
                    "Erreur récupération des contacts",

            });


        } finally {

            contactsLoading =
                false;

        }

    }
);


// ============================================================
// SERVEUR
// ============================================================

app.listen(
    PORT,
    () => {

        console.log(
            `🚀 WhatsApp service lancé sur http://localhost:${PORT}`
        );

    }
);


// ============================================================
// UTILITAIRE
// ============================================================

function sleep(ms) {

    return new Promise(
        resolve =>
            setTimeout(
                resolve,
                ms
            )
    );

}


// ============================================================
// ARRÊT PROPRE
// ============================================================

let shuttingDown =
    false;


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


    console.log(
        `\n🛑 Arrêt du service (${signal})...`
    );


    whatsappReady =
        false;


    const oldClient =
        client;


    client =
        null;


    await safeDestroyClient(
        oldClient
    );


    process.exit(0);

}


process.on(
    "SIGINT",
    () => shutdown("SIGINT")
);


process.on(
    "SIGTERM",
    () => shutdown("SIGTERM")
);


// ============================================================
// START
// ============================================================

initializeWhatsApp()
    .catch(
        (error) => {

            console.error(
                "❌ Erreur fatale initialisation WhatsApp :",
                error
            );

        }
    );