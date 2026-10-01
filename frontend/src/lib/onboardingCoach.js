export const actionHints = {
  "worker-name": ["Identifiez votre intervenant", "Saisissez son prénom et son nom pour le retrouver facilement dans votre équipe.", 2],
  "worker-phone": ["Ajoutez son numéro WhatsApp", "Utilisez le numéro sur lequel cette personne reçoit WhatsApp. Les autres informations sont facultatives.", 2],
  "worker-save": ["Enregistrez votre intervenant", "Ce bouton ajoute la personne à votre équipe. Elle ne recevra de demande que lorsque vous la sélectionnerez pour une mission et confirmerez l’envoi.", 2],
  resume: ["Continuez votre préparation ici", "Ce bouton vous ramène à la prochaine action utile pour votre mission. Le guide vous indiquera ensuite quoi faire sur place.", 2],
  start: ["Créez votre première mission ici", "Cliquez sur ce bouton. Commencez par le nom et le lieu de votre prestation : aucun message ne part à cette étape.", 1],
  name: ["Donnez un nom à votre mission", "Par exemple : « Montage salon de Lyon ». Ce nom permettra à votre équipe de reconnaître la prestation.", 1],
  location: ["Indiquez le lieu de rendez-vous", "Saisissez la ville ou le lieu de la prestation. L’adresse complète et les précisions restent facultatives.", 1],
  continue: ["Passez à la suite ici", "Cliquez sur Continuer pour préparer le créneau et les besoins de votre équipe.", 1],
  date: ["Choisissez la date de la prestation", "Un créneau correspond à une date et des horaires de travail. Vous pourrez en ajouter d’autres pour la même mission.", 1],
  hours: ["Précisez les horaires", "Indiquez le début et la fin du créneau. Un horaire de fin avant le début correspond à une fin le lendemain.", 1],
  needs: ["Combien de personnes vous faut-il ?", "Vérifiez le nombre de personnes et le tarif horaire proposé à chaque intervenant. Puis cliquez sur Continuer en bas du formulaire.", 1],
  create: ["Vérifiez, puis créez la mission ici", "Ce bouton enregistre la mission. Vous choisirez ensuite les contacts, avant tout envoi.", 1],
  team: ["Ajoutez votre équipe ici", "Cliquez ici pour retrouver vos contacts WhatsApp. Vous choisirez uniquement les personnes à importer ; aucun message ne sera envoyé.", 2],
  workers: ["Ajoutez vos intervenants ici", "Choisissez WhatsApp, les contacts du téléphone ou un ajout manuel. Vous restez libre de sélectionner qui contacter ensuite.", 2],
  "qr-open": ["Ouvrez le scanner de WhatsApp", "Sur votre téléphone : WhatsApp → Appareils connectés → Connecter un appareil. Cliquez ensuite sur ce bouton pour afficher le QR code.", 3],
  qr: ["Scannez ce QR code avec WhatsApp", "Sur votre téléphone : WhatsApp → Appareils connectés → Connecter un appareil. Gardez cette page ouverte pendant la liaison.", 3],
  phone: ["Reliez votre WhatsApp ici", "Saisissez le numéro de votre compte WhatsApp pour obtenir un code de liaison. Suivez ensuite les instructions affichées.", 3],
  contacts: ["Cochez les contacts de votre équipe", "Sélectionnez les personnes que vous souhaitez ajouter. Importer un contact ne lui envoie aucune invitation.", 2],
  import: ["Ajoutez les contacts sélectionnés", "Cliquez ici pour les retrouver dans votre équipe. Vous pourrez ensuite choisir les destinataires de cette mission.", 2],
  select: ["Choisissez qui contacter", "Cliquez sur les intervenants souhaités. Ils rejoignent la sélection ; les flèches permettent ensuite de changer leur ordre de priorité.", 4],
  review: ["Vérifiez votre sélection ici", "Ajustez l’ordre avec les flèches, puis cliquez ici pour voir le message. Aucun envoi ne démarre à ce clic.", 4],
  send: ["Le lancement se fait ici", "Relisez le message et les destinataires. Ce bouton lance réellement les demandes ; cliquez uniquement lorsque vous êtes prêt.", 4],
};

export const sectionHints = [
  { selectors: ['[data-testid="nav-dashboard"]', '[data-testid="mobile-nav-dashboard"]'], title: "Accueil : votre point de départ", text: "Retrouvez ici votre prochaine action, puis les missions et les réponses de votre équipe." },
  { selectors: ['[data-testid="nav-missions"]', '[data-testid="mobile-nav-missions"]'], title: "Missions : vos prestations", text: "Créez une mission, choisissez vos intervenants et suivez les confirmations depuis cette section." },
  { selectors: ['[data-testid="nav-workers"]', '[data-testid="mobile-nav-workers"]'], title: "Intervenants : votre réseau", text: "Ajoutez vos contacts et gérez la connexion WhatsApp. Ajouter quelqu’un ne lui envoie pas de message." },
  { selectors: ['[aria-label="Ouvrir mon compte"]'], title: "Votre compte et votre solde", text: "Cliquez sur votre profil pour retrouver vos crédits, votre photo, les offres, les paramètres et l’aide." },
];

export function coachPosition(rect, width, height, viewportWidth, viewportHeight) {
  const gap = 16, edge = 12, bottom = viewportWidth < 1024 ? 152 : 100;
  const maxY = Math.max(edge, viewportHeight - bottom - height);
  const clampY = y => Math.max(edge, Math.min(y, maxY));
  const clampX = x => Math.max(edge, Math.min(x, viewportWidth - width - edge));
  const offscreen = rect.bottom < 0 || rect.top > viewportHeight || rect.right < 0 || rect.left > viewportWidth;
  if (offscreen) return { left: viewportWidth - width - edge, top: maxY, side: "none", offscreen: true };
  if (viewportWidth >= 1024 && rect.right + gap + width <= viewportWidth - edge) return { left: rect.right + gap, top: clampY(rect.top), side: "left" };
  if (viewportWidth >= 1024 && rect.left - gap - width >= 268) return { left: rect.left - gap - width, top: clampY(rect.top), side: "right" };
  if (rect.top - gap - height >= edge) return { left: clampX(rect.left), top: rect.top - gap - height, side: "bottom" };
  if (rect.bottom + gap + height <= viewportHeight - bottom) return { left: clampX(rect.left), top: rect.bottom + gap, side: "top" };
  // If there is no room for the full card, keep the target clickable and scroll the help.
  const above = Math.max(0, Math.min(rect.top, viewportHeight - edge) - gap - edge);
  const below = Math.max(0, viewportHeight - edge - Math.max(rect.bottom, edge) - gap);
  const useAbove = above >= below;
  return { left: clampX(rect.left), top: useAbove ? edge : rect.bottom + gap, side: "none", maxHeight: Math.max(0, useAbove ? above : below) };
}
