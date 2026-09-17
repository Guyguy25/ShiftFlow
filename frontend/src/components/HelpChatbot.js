import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, ArrowLeft, ExternalLink } from "lucide-react";

const SUPPORT_WHATSAPP = "33661139861";
const SUPPORT_WHATSAPP_DISPLAY = "+33 6 61 13 98 61";
const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP}?text=${encodeURIComponent("Bonjour, j'ai une question à propos de ShiftFlow.")}`;

const KB = [
  {
    id: "create-mission",
    label: "Créer une mission",
    keywords: ["creer", "creation", "nouvelle", "mission", "ajouter mission"],
    answer:
      "Va dans « Missions » puis « Nouvelle mission ». Renseigne le lieu, les créneaux, le nombre de personnes nécessaires et les informations utiles. Une fois la mission créée, choisis les intervenants dans l'ordre de priorité et lance la cascade.",
  },
  {
    id: "invite-worker",
    label: "Ajouter un intervenant",
    keywords: ["intervenant", "worker", "equipe", "ajouter", "inviter", "contact"],
    answer:
      "Dans « Intervenants », tu peux ajouter quelqu'un manuellement ou importer ton équipe depuis WhatsApp. Sur les navigateurs mobiles compatibles, l'import depuis le répertoire du téléphone est aussi disponible.",
  },
  {
    id: "whatsapp",
    label: "Connecter WhatsApp",
    keywords: ["whatsapp", "qr", "qr code", "connecter", "appareil", "appareils connectes"],
    answer:
      "Pour connecter WhatsApp, ouvre WhatsApp sur ton téléphone puis va dans Paramètres / menu ⋮ → Appareils connectés → Connecter un appareil. Scanne ensuite le QR affiché par ShiftFlow avec le scanner intégré à WhatsApp, pas avec l'appareil photo classique.",
  },
  {
    id: "messages-confirm",
    label: "Comment partent les messages ?",
    keywords: ["message", "confirmation", "confirmer", "lien", "whatsapp", "envoi"],
    answer:
      "Quand tu lances une cascade, ShiftFlow utilise ton compte WhatsApp connecté pour contacter les intervenants dans l'ordre choisi. Ils reçoivent un lien pour accepter ou refuser sans avoir besoin d'un compte ShiftFlow.",
  },
  {
    id: "cascade",
    label: "C'est quoi la cascade ?",
    keywords: ["cascade", "relance", "no-show", "refus", "remplacant", "annulation"],
    answer:
      "La cascade contacte les intervenants selon ton ordre de priorité jusqu'à remplir les places nécessaires. Si quelqu'un refuse, annule ou doit être remplacé, ShiftFlow peut poursuivre avec la personne suivante sans que tu aies à relancer tout le monde manuellement.",
  },
  {
    id: "calendar",
    label: "Voir le calendrier",
    keywords: ["calendrier", "planning", "vue", "jour", "semaine"],
    answer:
      "La page « Calendrier » regroupe tes missions et tes créneaux pour voir rapidement ce qui arrive et où en sont les confirmations.",
  },
  {
    id: "history",
    label: "Retrouver une mission passée",
    keywords: ["historique", "passee", "ancienne", "archive"],
    answer:
      "Tes missions passées restent consultables dans « Historique » avec leur état et les intervenants associés.",
  },
  {
    id: "settings-log",
    label: "Voir les envois WhatsApp",
    keywords: ["journal", "log", "envoyes", "parametres", "compte", "agence", "erreur"],
    answer:
      "Dans « Paramètres », le journal des envois WhatsApp permet de vérifier les messages partis et les éventuels échecs. Si WhatsApp s'est déconnecté, reconnecte la session avant de relancer l'envoi.",
  },
  {
    id: "pricing",
    label: "Tarifs & abonnement",
    keywords: ["tarif", "prix", "abonnement", "payer", "pro", "gratuit", "plan"],
    answer:
      "Le plan gratuit inclut 1 mission active et jusqu'à 10 intervenants. Le plan Pro est à 49 €/mois pour lever ces limites et continuer à utiliser ShiftFlow sans engagement.",
  },
];

function normalize(str) {
  return (str || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function findAnswer(text) {
  const q = normalize(text);
  let best = null;
  let bestScore = 0;
  for (const entry of KB) {
    let score = 0;
    for (const kw of entry.keywords) {
      if (q.includes(normalize(kw))) score += 1;
    }
    if (score > bestScore) {
      bestScore = score;
      best = entry;
    }
  }
  return bestScore > 0 ? best : null;
}

const FALLBACK =
  "Je n'ai pas de réponse assez précise pour te répondre sans risque de t'induire en erreur. Pour un problème spécifique, contacte directement le support WhatsApp.";

const WELCOME =
  "Bonjour 👋 Je suis l'assistant ShiftFlow. Choisis un sujet ou écris ta question. Si ton problème est spécifique, tu peux aussi contacter directement le support WhatsApp.";

export default function HelpChatbot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([{ from: "bot", text: WELCOME }]);
  const [input, setInput] = useState("");
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open]);

  const pushBot = (text) => setMessages((m) => [...m, { from: "bot", text }]);
  const pushUser = (text) => setMessages((m) => [...m, { from: "user", text }]);

  const askTopic = (entry) => {
    pushUser(entry.label);
    pushBot(entry.answer);
  };

  const handleSend = (e) => {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    pushUser(text);
    setInput("");
    const match = findAnswer(text);
    pushBot(match ? match.answer : FALLBACK);
  };

  return (
    <div className="fixed bottom-5 right-5 z-50" data-testid="help-chatbot">
      {open && (
        <div className="mb-3 w-[calc(100vw-2.5rem)] sm:w-96 h-[31rem] bg-white rounded-2xl border border-gray-200 shadow-[0_18px_60px_rgba(15,23,42,0.18)] flex flex-col overflow-hidden">
          <div className="bg-gray-950 text-white px-4 py-3.5 flex items-center justify-between shrink-0">
            <div>
              <div className="font-display font-semibold text-sm">Assistant ShiftFlow</div>
              <div className="text-[11px] text-gray-400 mt-0.5">Aide rapide + support humain</div>
            </div>
            <button onClick={() => setOpen(false)} aria-label="Fermer" data-testid="help-chatbot-close" className="p-1 rounded hover:bg-white/10">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-line ${m.from === "user" ? "bg-blue-600 text-white rounded-br-sm" : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"}`}>
                  {m.text}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-1.5 pt-1">
              {KB.map((entry) => (
                <button key={entry.id} onClick={() => askTopic(entry)} data-testid={`help-chatbot-topic-${entry.id}`} className="text-xs px-2.5 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors">
                  {entry.label}
                </button>
              ))}
            </div>

            <div className="mt-3 rounded-xl border border-green-200 bg-green-50 p-3">
              <div className="text-xs font-semibold text-green-900">Un problème spécifique ?</div>
              <div className="mt-1 text-xs text-green-800">Écris directement sur WhatsApp au {SUPPORT_WHATSAPP_DISPLAY}.</div>
              <a href={SUPPORT_WHATSAPP_URL} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-green-800 hover:text-green-950">
                Contacter le support <ExternalLink className="w-3 h-3" />
              </a>
            </div>
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-gray-200 p-2 flex items-center gap-2 shrink-0 bg-white">
            <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Pose ta question…" data-testid="help-chatbot-input" className="flex-1 h-9 px-3 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <button type="submit" data-testid="help-chatbot-send" className="w-9 h-9 shrink-0 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center" aria-label="Envoyer">
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <button onClick={() => setOpen((o) => !o)} data-testid="help-chatbot-toggle" aria-label="Ouvrir l'assistant" className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105">
        {open ? <ArrowLeft className="w-5 h-5" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}
