// Questionnaire d'inscription — un écran par question.
// Les clés et libellés d'options sont conservés tels quels : ils sont stockés
// dans onboarding_answers et filtrés par lib/registrationDraft.safeAnswers.
import {
  Crown, Settings2, ClipboardList, User, MessageCircle, Phone, MessageSquare, Mail, Monitor, MoreHorizontal,
  Sheet, FileText, MessagesSquare, CalendarDays, CircleSlash, Target, Clock, Flag, Rocket, AlertTriangle, Repeat,
} from "lucide-react";

export const questions = [
  { key: "role", icon: User, eyebrow: "Vous", label: "Quel est votre rôle ?", options: [
    { value: "Dirigeant / fondateur", icon: Crown },
    { value: "Responsable des opérations", icon: Settings2 },
    { value: "Chef de projet / coordinateur", icon: ClipboardList },
    { value: "Autre rôle", icon: User },
  ] },
  { key: "biggest_problem", icon: AlertTriangle, eyebrow: "Votre quotidien", label: "Quel est votre plus gros problème de coordination ?", options: [
    "Obtenir les disponibilités et confirmations", "Remplacer les absents au dernier moment", "Éviter les oublis et erreurs de planning",
    "Relancer sans cesse les équipes", "Suivre les heures effectuées", "Tout fonctionne bien pour le moment", "Autre problème",
  ] },
  { key: "frequency", icon: Repeat, eyebrow: "Votre quotidien", label: "À quelle fréquence rencontrez-vous ce problème ?", options: [
    "À chaque mission", "Plusieurs fois par mois", "Quelques fois par an", "Rarement / jamais",
  ] },
  { key: "impact", icon: Clock, eyebrow: "Votre quotidien", label: "Combien de temps consacrez-vous à la coordination chaque semaine ?", options: [
    "Moins de 2 heures", "2 à 5 heures", "5 à 10 heures", "Plus de 10 heures", "Je ne sais pas",
  ] },
  { key: "channels", icon: MessageCircle, eyebrow: "Vos outils", multi: true, label: "Comment contactez-vous vos équipes aujourd’hui ?", hint: "Plusieurs réponses possibles.", options: [
    { value: "WhatsApp", icon: MessageCircle }, { value: "Appels téléphoniques", icon: Phone }, { value: "SMS", icon: MessageSquare },
    { value: "Email", icon: Mail }, { value: "Logiciel dédié", icon: Monitor }, { value: "Autre", icon: MoreHorizontal },
  ] },
  { key: "planning", icon: CalendarDays, eyebrow: "Vos outils", label: "Où centralisez-vous votre planning ?", options: [
    { value: "Excel / Google Sheets", icon: Sheet }, { value: "Papier", icon: FileText }, { value: "Dans les conversations", icon: MessagesSquare },
    { value: "Logiciel de planning", icon: CalendarDays }, { value: "Aucun planning centralisé", icon: CircleSlash },
  ] },
  { key: "priority", icon: Target, eyebrow: "Vos objectifs", label: "Qu’aimeriez-vous améliorer en premier ?", options: [
    "Réduire les relances", "Sécuriser les effectifs", "Centraliser les informations", "Fiabiliser le suivi des heures",
  ] },
  { key: "goal", icon: Flag, eyebrow: "Vos objectifs", label: "Quel résultat vous ferait dire que ShiftFlow vous est utile ?", options: [
    "Passer moins de temps à organiser", "Avoir une équipe confirmée plus tôt", "Gérer les imprévus plus sereinement", "Disposer d’un suivi fiable",
  ] },
  { key: "timeline", icon: Rocket, eyebrow: "Vos objectifs", label: "Quand souhaitez-vous faire évoluer votre organisation ?", options: [
    "Pour ma prochaine mission", "Dans le mois", "Dans les 3 prochains mois", "Je me renseigne seulement",
  ] },
].map(q => ({ ...q, options: q.options.map(o => (typeof o === "string" ? { value: o } : o)) }));

// Ordre des écrans : facile et personnel d'abord, le « aha » chiffré au milieu,
// les objectifs ensuite, le texte libre (facultatif) en dernier.
export const SCREENS = [
  "account", "agency", "role", "biggest_problem", "frequency", "impact",
  "channels", "planning", "volume", "priority", "goal", "timeline", "context", "recap",
];

export const isAnswered = (key, answers) => {
  const value = answers[key];
  return Array.isArray(value) ? value.length > 0 : Boolean(value);
};
