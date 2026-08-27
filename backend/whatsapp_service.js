const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const QRCode = require("qrcode");
const path = require("path");

const app = express();

const PORT = process.env.WHATSAPP_PORT || 3001;

app.use(express.json());


// ==========================================
// ÉTAT WHATSAPP
// ==========================================

let whatsappReady = false;
let currentQR = null;
let contacts = [];


// ==========================================
// ÉTAT RÉCUPÉRATION CONTACTS
// ==========================================

// Empêche plusieurs récupérations simultanées
let contactsLoading = false;

// Indique si les contacts ont déjà été chargés
// pour la connexion WhatsApp actuelle
let contactsLoadedForSession = false;


// ==========================================
// CLIENT WHATSAPP
// ==========================================

const client = new Client({

    authStrategy: new LocalAuth({
        dataPath: path.join(
            __dirname,
            "whatsapp-session"
        ),
    }),

    puppeteer: {

        headless: true,

        // Important pour éviter les timeouts
        // Puppeteer / WhatsApp Web.
        protocolTimeout: 120000,

        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",

            // Réduit légèrement la consommation
            // de ressources Chromium.
            "--disable-dev-shm-usage",
        ],
    },
});


// ==========================================
// QR CODE
// ==========================================

client.on("qr", async (qr) => {

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
});


// ==========================================
// AUTHENTIFICATION
// ==========================================

client.on("authenticated", () => {

    console.log(
        "🔐 WhatsApp authentifié"
    );

});


// ==========================================
// AUTHENTIFICATION ÉCHOUÉE
// ==========================================

client.on("auth_failure", (message) => {

    console.error(
        "❌ Échec authentification WhatsApp :",
        message
    );

    whatsappReady = false;

    currentQR = null;

    contacts = [];

    contactsLoadedForSession = false;

    contactsLoading = false;
});


// ==========================================
// WHATSAPP PRÊT
// ==========================================

client.on("ready", async () => {

    console.log(
        "✅ WhatsApp connecté"
    );

    whatsappReady = true;

    currentQR = null;


    // --------------------------------------
    // Éviter les doubles récupérations
    // --------------------------------------

    if (
        contactsLoadedForSession ||
        contactsLoading
    ) {

        console.log(
            "ℹ️ Contacts déjà chargés pour cette session"
        );

        return;
    }


    contactsLoading = true;


    try {

        // ----------------------------------
        // ATTENTE SYNCHRONISATION
        // ----------------------------------

        console.log(
            "⏳ Attente de la synchronisation WhatsApp..."
        );

        await sleep(15000);


        // ----------------------------------
        // CHARGEMENT
        // ----------------------------------

        await loadContacts();

        contactsLoadedForSession = true;

    } catch (error) {

        console.error(
            "❌ Erreur récupération contacts :",
            error
        );

    } finally {

        contactsLoading = false;
    }

});


// ==========================================
// CHARGEMENT DES CONTACTS
// ==========================================

async function loadContacts() {

    console.log(
        "⏳ Récupération des contacts..."
    );


    // ======================================
    // RÉCUPÉRATION
    // ======================================

    const allContacts =
        await client.getContacts();


    console.log(
        `📦 ${allContacts.length} entrées reçues`
    );


    const contactsByNumber =
        new Map();


    // ======================================
    // PARCOURIR LES CONTACTS
    // ======================================

    for (
        const contact of allContacts
    ) {

        // ----------------------------------
        // Groupes
        // ----------------------------------

        if (contact.isGroup) {
            continue;
        }


        // ----------------------------------
        // Pas un contact WhatsApp
        // ----------------------------------

        if (!contact.isWAContact) {
            continue;
        }


        // ----------------------------------
        // Pas d'identifiant
        // ----------------------------------

        if (!contact.id) {
            continue;
        }


        // ----------------------------------
        // IDENTIFIANT
        // ----------------------------------

        const serializedId =
            contact.id._serialized || "";


        if (!serializedId) {
            continue;
        }


        const isPhoneId =
            serializedId.endsWith("@c.us");


        const isLid =
            serializedId.endsWith("@lid");


        // ----------------------------------
        // NOM
        // ----------------------------------

        const name =
            contact.name ||
            contact.pushname ||
            contact.shortName ||
            "";


        // On garde uniquement les contacts
        // ayant un nom exploitable.
        if (!name.trim()) {
            continue;
        }


        // ==================================
        // CAS @c.us
        // ==================================

        if (isPhoneId) {

            let number =
                contact.id.user;


            if (!number) {
                continue;
            }


            number =
                String(number)
                    .replace(/\D/g, "");


            if (!number) {
                continue;
            }


            if (
                !contactsByNumber.has(number)
            ) {

                contactsByNumber.set(
                    number,
                    {
                        id: serializedId,
                        name: name.trim(),
                        number: number,
                        isMyContact:
                            contact.isMyContact,
                    }
                );
            }


            continue;
        }


        // ==================================
        // CAS @lid
        // ==================================

        if (isLid) {

            try {

                const result =
                    await client.getContactLidAndPhone(
                        [serializedId]
                    );


                if (
                    result &&
                    result.length > 0 &&
                    result[0].pn
                ) {

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


                    if (!number) {
                        continue;
                    }


                    if (
                        !contactsByNumber.has(number)
                    ) {

                        contactsByNumber.set(
                            number,
                            {
                                id: serializedId,
                                name: name.trim(),
                                number: number,
                                isMyContact:
                                    contact.isMyContact,
                            }
                        );
                    }

                }

            } catch (error) {

                // Un LID qui ne peut pas être
                // résolu n'empêche pas les autres
                // contacts d'être importés.

                console.log(
                    `⚠️ LID non résolu : ${name}`
                );
            }

            continue;
        }

    }


    // ======================================
    // RÉSULTAT
    // ======================================

    contacts =
        Array.from(
            contactsByNumber.values()
        );


    console.log(
        `✅ ${contacts.length} vrais contacts récupérés`
    );

}


// ==========================================
// DÉCONNEXION
// ==========================================

client.on(
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

    }
);


// ==========================================
// ERREUR CLIENT
// ==========================================

client.on(
    "error",
    (error) => {

        console.error(
            "❌ Erreur WhatsApp :",
            error
        );

    }
);


// ==========================================
// STATUT
// ==========================================

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

        });

    }
);


// ==========================================
// CONTACTS
// ==========================================

app.get(
    "/contacts",
    (req, res) => {

        if (!whatsappReady) {

            return res.status(400).json({

                error:
                    "WhatsApp n'est pas connecté",

            });

        }


        res.json(contacts);

    }
);


// ==========================================
// ACTUALISER LES CONTACTS
// ==========================================

app.post(
    "/refresh",
    async (req, res) => {

        if (!whatsappReady) {

            return res.status(400).json({

                error:
                    "WhatsApp n'est pas connecté",

            });

        }


        if (contactsLoading) {

            return res.status(409).json({

                error:
                    "Récupération des contacts déjà en cours",

            });

        }


        contactsLoading = true;


        try {

            await loadContacts();

            contactsLoadedForSession = true;


            res.json({

                success: true,

                count:
                    contacts.length,

            });

        } catch (error) {

            console.error(
                "❌ Erreur refresh contacts :",
                error
            );


            res.status(500).json({

                success: false,

                error:
                    "Erreur récupération des contacts",

            });

        } finally {

            contactsLoading = false;

        }

    }
);


// ==========================================
// SERVEUR
// ==========================================

app.listen(
    PORT,
    () => {

        console.log(
            `🚀 WhatsApp service lancé sur http://localhost:${PORT}`
        );

    }
);


// ==========================================
// UTILITAIRE
// ==========================================

function sleep(ms) {

    return new Promise(
        (resolve) =>
            setTimeout(resolve, ms)
    );

}


// ==========================================
// INITIALISATION WHATSAPP
// ==========================================

client.initialize();