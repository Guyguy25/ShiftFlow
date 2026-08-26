const { Client, LocalAuth } = require("whatsapp-web.js");
const express = require("express");
const QRCode = require("qrcode");
const path = require("path");

const app = express();
const PORT = process.env.WHATSAPP_PORT || 3001;

app.use(express.json());

let whatsappReady = false;
let currentQR = null;
let contacts = [];

// Empêche plusieurs récupérations pendant la même connexion
let contactsLoadedForSession = false;
let contactsLoading = false;

const client = new Client({
    authStrategy: new LocalAuth({
        dataPath: path.join(__dirname, "whatsapp-session"),
    }),

    puppeteer: {
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
        ],
    },
});

// ==========================================
// QR CODE
// ==========================================

client.on("qr", async (qr) => {
    try {
        currentQR = await QRCode.toDataURL(qr);
        whatsappReady = false;

        // Nouvelle session => on autorise une nouvelle récupération
        contactsLoadedForSession = false;
        contacts = [];

        console.log("📱 Nouveau QR WhatsApp disponible");
    } catch (error) {
        console.error("Erreur génération QR :", error);
        currentQR = null;
    }
});

// ==========================================
// AUTHENTIFICATION
// ==========================================

client.on("authenticated", () => {
    console.log("🔐 WhatsApp authentifié");
});

// ==========================================
// PRÊT
// ==========================================

client.on("ready", async () => {
    console.log("✅ WhatsApp connecté");

    whatsappReady = true;
    currentQR = null;

    // Évite que plusieurs événements "ready"
    // lancent plusieurs récupérations
    if (contactsLoadedForSession || contactsLoading) {
        console.log("ℹ️ Contacts déjà récupérés pour cette session");
        return;
    }

    contactsLoading = true;

    try {
        // Laisse WhatsApp terminer sa synchronisation
        console.log("⏳ Attente de la synchronisation WhatsApp...");
        await new Promise((resolve) => setTimeout(resolve, 5000));

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
    try {
        console.log("⏳ Récupération des contacts...");

        const allContacts = await client.getContacts();

        console.log(`📦 ${allContacts.length} entrées reçues`);

        const contactsByNumber = new Map();

        for (const contact of allContacts) {
            // Ignorer les groupes
            if (contact.isGroup) {
                continue;
            }

            // Ignorer les contacts non WhatsApp
            if (!contact.isWAContact) {
                continue;
            }

            if (!contact.id) {
                continue;
            }

            const serializedId =
                contact.id._serialized || "";

            const isLid =
                serializedId.endsWith("@lid");

            const isPhoneId =
                serializedId.endsWith("@c.us");

            // ==========================================
            // NOM
            // ==========================================

            const name =
                contact.name ||
                contact.pushname ||
                contact.shortName ||
                "";

            // IMPORTANT :
            // aucun nom = contact inutile pour l'application
            if (!name.trim()) {
                continue;
            }

            // ==========================================
            // CAS @c.us
            // ==========================================

            if (isPhoneId) {
                let number = contact.id.user;

                if (!number) {
                    continue;
                }

                number = String(number).replace(/\D/g, "");

                if (!number) {
                    continue;
                }

                if (!contactsByNumber.has(number)) {
                    contactsByNumber.set(number, {
                        id: serializedId,
                        name: name.trim(),
                        number,
                        isMyContact: contact.isMyContact,
                    });
                }

                continue;
            }

            // ==========================================
            // CAS @lid
            // ==========================================

            if (isLid) {
                try {
                    const result =
                        await client.getContactLidAndPhone([
                            serializedId,
                        ]);

                    if (
                        result &&
                        result.length > 0 &&
                        result[0].pn
                    ) {
                        let number = result[0].pn;

                        number = number
                            .replace("@c.us", "")
                            .replace("@s.whatsapp.net", "")
                            .replace(/\D/g, "");

                        if (!number) {
                            continue;
                        }

                        if (!contactsByNumber.has(number)) {
                            contactsByNumber.set(number, {
                                id: serializedId,
                                name: name.trim(),
                                number,
                                isMyContact:
                                    contact.isMyContact,
                            });
                        }
                    }
                } catch (error) {
                    console.log(
                        `⚠️ Impossible de résoudre : ${name}`
                    );
                }

                continue;
            }
        }

        contacts =
            Array.from(contactsByNumber.values());

        console.log(
            `✅ ${contacts.length} vrais contacts récupérés`
        );
    } catch (error) {
        console.error(
            "❌ Erreur récupération contacts :",
            error
        );

        throw error;
    }
}

// ==========================================
// DÉCONNEXION
// ==========================================

client.on("disconnected", (reason) => {
    console.log("❌ WhatsApp déconnecté :", reason);

    whatsappReady = false;
    currentQR = null;
    contacts = [];

    // Permettra une nouvelle récupération
    // lors de la prochaine connexion
    contactsLoadedForSession = false;
    contactsLoading = false;
});

// ==========================================
// STATUT
// ==========================================

app.get("/status", (req, res) => {
    res.json({
        connected: whatsappReady,
        hasQR: !!currentQR,
        qr: currentQR,
        contactCount: contacts.length,
    });
});

// ==========================================
// CONTACTS
// ==========================================

app.get("/contacts", (req, res) => {
    if (!whatsappReady) {
        return res.status(400).json({
            error: "WhatsApp n'est pas connecté",
        });
    }

    res.json(contacts);
});

// ==========================================
// ACTUALISER LES CONTACTS
// ==========================================

app.post("/refresh", async (req, res) => {
    if (!whatsappReady) {
        return res.status(400).json({
            error: "WhatsApp n'est pas connecté",
        });
    }

    if (contactsLoading) {
        return res.status(409).json({
            error: "Récupération des contacts déjà en cours",
        });
    }

    contactsLoading = true;

    try {
        await loadContacts();

        contactsLoadedForSession = true;

        res.json({
            success: true,
            count: contacts.length,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: "Erreur récupération des contacts",
        });
    } finally {
        contactsLoading = false;
    }
});

// ==========================================
// SERVEUR
// ==========================================

app.listen(PORT, () => {
    console.log(
        `🚀 WhatsApp service lancé sur http://localhost:${PORT}`
    );
});

// ==========================================
// WHATSAPP
// ==========================================

client.initialize();