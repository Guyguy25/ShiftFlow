export const PAYMENT_PROVIDER_LABEL = "Whop (Stripe pour les abonnements existants)";
export const YEARLY = { total: "278,40", monthly: "23,20", discount: "20", saving: "69,60" };

export const PLAN_OFFERS = [
  { key: "start", name: "Start", monthly: 29, yearly: 278.40, discount: 20, tagline: "L'essentiel pour les petites équipes", people: "3 missions par mois · 1 responsable", features: ["Intervenants et contacts illimités", "Invitations et relances WhatsApp", "Remplacement en cascade", "Calendrier et relevés d’heures"] },
  { key: "pro", name: "Pro", monthly: 79, yearly: 711, discount: 25, tagline: "Pour les prestataires réguliers", people: "20 missions par mois · Vous + 3 collaborateurs", features: ["Toutes les fonctions de Start", "Missions partagées avec les collaborateurs", "Comptes individuels et gestion des accès", "20 missions par mois pour votre équipe"] },
  { key: "business", name: "Business", monthly: 149, yearly: 1072.80, discount: 40, tagline: "Pour coordonner plusieurs équipes", people: "Missions illimitées · Vous + 10 collaborateurs", features: ["Toutes les fonctions de Pro", "Administrateurs et coordinateurs", "Gestion avancée des autorisations", "Pilotage multi-organisations"] },
];
