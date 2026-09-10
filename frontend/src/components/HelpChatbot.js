import React, { useEffect, useRef, useState } from "react";
import { MessageCircle, X, Send, ArrowLeft } from "lucide-react";

// ---------------------------------------------------------------------------
// Chatbot d'aide 100% gratuit et 100% "sur rails" : pas d'API, pas de coût,
// pas d'hallucination possible — il ne peut répondre qu'avec ce qui est
// écrit dans KB ci-dessous. Si rien ne correspond, il le dit et propose les
// sujets qu'il connaît + un contact humain.
// Remplace SUPPORT_CONTACT par ton adresse e-mail officielle une fois que tu
// auras ton nom de domaine — en attendant ça pointe vers ton Calendly.
// ---------------------------------------------------------------------------
const SUPPORT_CONTACT = "https://calendly.com/tanguybois/appel";

const KB = [
  {
    id: "create-mission",
    label: "Créer une mission",
    keywords: ["creer", "creation", "nouvelle", "mission", "ajouter mission"],
    answer:
      "Va dans « Missions » puis clique sur « Nouvelle mission ». Renseigne le nom, la date, les horaires et le nombre de personnes nécessaires. Tu peux activer l'option « cascade » pour que ShiftFlow relance automatiquement l'intervenant suivant si quelqu'un ne confirme pas à temps.",
  },
  {
    id: "invite-worker",
    label: "Ajouter un intervenant",
    keywords: ["intervenant", "worker", "equipe", "ajouter", "inviter", "contact"],
    answer:
      "Rends-toi sur la page « Intervenants » pour ajouter un équipier : nom et téléphone sont obligatoires, l'email et les compétences (montage, démontage, technique, électricité, manutention) sont optionnels mais utiles pour filtrer. Tu peux ensuite l'assigner à une mission depuis la création de la mission ou depuis sa fiche détail.",
  },
  {
    id: "sms-confirm",
    label: "Comment marchent les SMS ?",
    keywords: ["sms", "confirmation", "confirmer", "lien", "texto", "message"],
    answer:
      "Dès qu'un intervenant est assigné à une mission, il reçoit un SMS avec un lien unique pour accepter ou refuser. Tu vois en temps réel qui a confirmé sur la fiche de la mission et sur le calendrier. Un rappel automatique est aussi envoyé ~24h avant le shift à ceux qui ont confirmé.",
  },
  {
    id: "cascade",
    label: "C'est quoi la cascade de relance ?",
    keywords: ["cascade", "relance", "no-show", "refus", "remplacant", "annulation"],
    answer:
      "Si un intervenant refuse ou ne répond pas dans le délai que tu as fixé, ShiftFlow relance automatiquement la personne suivante sur la liste — pas besoin de relancer toi-même par téléphone. Tu actives/désactives cette option à la création de la mission.",
  },
  {
    id: "calendar",
    label: "Voir le calendrier",
    keywords: ["calendrier", "planning", "vue", "jour", "semaine"],
    answer:
      "La page « Calendrier » te donne une vue d'ensemble de toutes tes missions planifiées, jour par jour, avec le taux de confirmation de chaque créneau en un coup d'œil.",
  },
  {
    id: "history",
    label: "Retrouver une mission passée",
    keywords: ["historique", "passee", "ancienne", "archive"],
    answer:
      "Toutes tes missions terminées sont classées dans « Historique », consultables à tout moment avec le détail des confirmations et refus.",
  },
  {
    id: "settings-sms-log",
    label: "Voir les SMS envoyés",
    keywords: ["journal", "log", "envoyes", "parametres", "compte", "agence"],
    answer:
      "Dans « Paramètres », tu retrouves les infos de ton agence, la configuration de l'envoi SMS, et le journal des 30 derniers SMS envoyés pour vérifier que tout part bien.",
  },
  {
    id: "pricing",
    label: "Tarifs & abonnement",
    keywords: ["tarif", "prix", "abonnement", "payer", "pro", "gratuit", "plan"],
    answer:
      "Le compte gratuit permet de gérer 1 mission. Pour des missions illimitées, tu passes au plan Pro depuis le bouton « Passer au Pro » dans le menu de gauche ou la page Tarifs.",
  },
  {
    id: "login-session",
    label: "Je suis déconnecté trop souvent",
    keywords: ["connexion", "deconnecte", "login", "session", "mot de passe"],
    answer:
      "Ta session reste active automatiquement tant que tu reviens au moins une fois tous les 90 jours — tu n'as normalement pas besoin de te reconnecter à chaque visite. Si le problème persiste, essaie de te reconnecter une fois pour rafraîchir ta session.",
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
  "Je n'ai pas de réponse précise à te donner là-dessus, je préfère ne pas te dire n'importe quoi. Choisis un sujet ci-dessous, ou écris-nous directement.";

const WELCOME =
  "Bonjour 👋 Je suis l'assistant ShiftFlow. Choisis un sujet ou écris ta question, je ne réponds que sur l'utilisation de l'app.";

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
    if (match) {
      pushBot(match.answer);
    } else {
      pushBot(`${FALLBACK}\n\nOu prends directement rendez-vous ici : ${SUPPORT_CONTACT}`);
    }
  };

  return (
    <div className="fixed bottom-5 right-5 z-50" data-testid="help-chatbot">
      {open && (
        <div className="mb-3 w-80 sm:w-96 h-[28rem] bg-white rounded-xl border border-gray-200 shadow-[0_12px_40px_rgba(0,0,0,0.15)] flex flex-col overflow-hidden">
          <div className="bg-blue-600 text-white px-4 py-3 flex items-center justify-between shrink-0">
            <span className="font-display font-semibold text-sm">Assistant ShiftFlow</span>
            <button onClick={() => setOpen(false)} aria-label="Fermer" data-testid="help-chatbot-close">
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2 bg-gray-50">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.from === "user" ? "justify-end" : "justify-start"}`}>
                <div
                  className={`max-w-[85%] px-3 py-2 rounded-lg text-sm whitespace-pre-line ${
                    m.from === "user"
                      ? "bg-blue-600 text-white rounded-br-sm"
                      : "bg-white text-gray-800 border border-gray-200 rounded-bl-sm"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            <div className="flex flex-wrap gap-1.5 pt-1">
              {KB.map((entry) => (
                <button
                  key={entry.id}
                  onClick={() => askTopic(entry)}
                  data-testid={`help-chatbot-topic-${entry.id}`}
                  className="text-xs px-2.5 py-1.5 rounded-full border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors"
                >
                  {entry.label}
                </button>
              ))}
            </div>
            <div ref={bottomRef} />
          </div>

          <form onSubmit={handleSend} className="border-t border-gray-200 p-2 flex items-center gap-2 shrink-0 bg-white">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Pose ta question…"
              data-testid="help-chatbot-input"
              className="flex-1 h-9 px-3 text-sm rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              data-testid="help-chatbot-send"
              className="w-9 h-9 shrink-0 rounded-md bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center"
              aria-label="Envoyer"
            >
              <Send className="w-4 h-4" />
            </button>
          </form>
        </div>
      )}

      <button
        onClick={() => setOpen((o) => !o)}
        data-testid="help-chatbot-toggle"
        aria-label="Ouvrir l'assistant"
        className="w-14 h-14 rounded-full bg-blue-600 hover:bg-blue-700 text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
      >
        {open ? <ArrowLeft className="w-5 h-5" /> : <MessageCircle className="w-6 h-6" />}
      </button>
    </div>
  );
}