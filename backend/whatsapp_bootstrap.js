/*
 * Baileys contact bridge.
 *
 * WhatsApp/Baileys can expose a chat without exposing the local phonebook name.
 * In that case we still keep the person, using the phone number as the display
 * name instead of silently dropping the contact. If WhatsApp gives us a real
 * name (name/subject/notify/pushName), that name wins.
 */
const baileysPath = require.resolve("@whiskeysockets/baileys");
const baileys = require(baileysPath);
const originalMakeWASocket = baileys.default;

function isPersonOrLid(id) {
  const value = String(id || "");
  return value.endsWith("@s.whatsapp.net") || value.endsWith("@lid");
}

function looksLikePhone(value) {
  const text = String(value || "").trim();
  if (!text) return true;
  const digits = (text.match(/\d/g) || []).length;
  const letters = (text.match(/[A-Za-zÀ-ÖØ-öø-ÿ]/g) || []).length;
  return !letters || (digits >= 6 && digits >= letters);
}

function nameFromChat(chat) {
  for (const value of [chat?.name, chat?.subject, chat?.notify, chat?.pushName]) {
    const name = String(value || "").trim();
    if (name && !looksLikePhone(name)) return name;
  }
  return "";
}

function phoneFromChat(chat) {
  // Explicit PN fields are safe to use for both normal JIDs and LIDs.
  for (const value of [chat?.phoneNumber, chat?.number, chat?.pn]) {
    const raw = String(value || "");
    const digits = raw.replace(/\D/g, "");
    if (/^\d{10,15}$/.test(digits)) return digits;
  }

  // A @lid identifier is NOT a phone number even though it is numeric.
  // Only normal WhatsApp person JIDs may use the JID digits as a fallback.
  for (const value of [chat?.jid, chat?.id]) {
    const raw = String(value || "");
    if (!raw.endsWith("@s.whatsapp.net")) continue;
    const digits = raw.split("@")[0].replace(/\D/g, "");
    if (/^\d{10,15}$/.test(digits)) return digits;
  }
  return "";
}

baileys.default = function patchedMakeWASocket(...args) {
  const sock = originalMakeWASocket(...args);

  const bridgeChat = (chat) => {
    const id = String(chat?.id || chat?.jid || "");
    if (!isPersonOrLid(id)) return;

    const phoneNumber = phoneFromChat(chat);
    const realName = nameFromChat(chat);

    // For a normal PN chat, the JID itself contains the phone number. This is
    // the important fallback for contacts such as Baba: if WhatsApp does not
    // transmit the saved address-book label, ShiftFlow must still show the
    // contact instead of dropping it completely.
    const number = phoneNumber || (id.endsWith("@s.whatsapp.net") ? id.split("@")[0] : "");
    if (!/^\d{10,15}$/.test(number)) return;

    const name = realName || `+${number}`;
    const synthetic = { id, name, phoneNumber: number };

    // whatsapp_service.js already listens to contacts.upsert. We emit only
    // person/LID chat metadata; groups are excluded above.
    sock.ev.emit("contacts.upsert", [synthetic]);
  };

  sock.ev.on("chats.upsert", (chats) => {
    for (const chat of Array.isArray(chats) ? chats : []) bridgeChat(chat);
  });

  sock.ev.on("chats.update", (updates) => {
    for (const chat of Array.isArray(updates) ? updates : []) bridgeChat(chat);
  });

  return sock;
};

require("./whatsapp_service.js");
