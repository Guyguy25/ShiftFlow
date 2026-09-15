/*
 * Baileys contact bridge.
 *
 * We keep whatsapp_service.js untouched and inject one narrow bridge before it
 * registers its own event listeners. WhatsApp can expose a person's local
 * contact/display name through chat events even when contacts.upsert is missing
 * or incomplete (a known problem in some Baileys v7 releases).
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
  for (const value of [chat?.phoneNumber, chat?.number, chat?.pn, chat?.jid]) {
    const raw = String(value || "");
    const digits = raw.replace(/\D/g, "");
    if (/^\d{10,15}$/.test(digits)) return digits;
  }
  return "";
}

baileys.default = function patchedMakeWASocket(...args) {
  const sock = originalMakeWASocket(...args);

  const bridgeChat = (chat) => {
    const id = String(chat?.id || chat?.jid || "");
    const name = nameFromChat(chat);
    if (!isPersonOrLid(id) || !name) return;

    const phoneNumber = phoneFromChat(chat);
    const synthetic = {
      id,
      name,
      ...(phoneNumber ? { phoneNumber } : {}),
    };

    // whatsapp_service.js already listens to contacts.upsert. We deliberately
    // emit only named person/LID chats, never message history/pushName globally.
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
