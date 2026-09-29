export function activationNext(summary, whatsapp, quota) {
  if (!summary.activation || summary.activation.first_invite_sent) return null;
  if (quota?.trial_expired) return { label: "Consulter mon offre", href: "/pricing", description: "Votre essai est terminé. Consultez votre offre pour reprendre vos recherches." };
  const mission = [...summary.ongoing, ...summary.upcoming].find(m =>
    m.status !== "cancelled" && m.shifts?.some(s => s.status !== "cancelled" && Number(s.confirmed_count || 0) < Number(s.people_needed)));
  const href = mission ? `/app/missions/${mission.id}?step=select` : "/app/missions/new";
  if (!mission) return { label: summary.missions_total ? "Créer une mission à venir" : "Créer ma première mission", href, description: "Indiquez où, quand et combien de personnes vous cherchez." };
  if (!summary.activation.active_workers) return { label: "Ajouter mes intervenants", href: `/app/workers?add=1&returnTo=${encodeURIComponent(href)}`, description: `Préparez les personnes à contacter pour « ${mission.name} ».` };
  if (!whatsapp) return { label: "Vérifier WhatsApp", connect: true, description: "La connexion WhatsApp n’a pas pu être vérifiée. Ouvrez-la pour réessayer." };
  if (!whatsapp.connected) return { label: "Connecter WhatsApp", connect: true, description: "Connectez le compte qui enverra vos demandes de disponibilité." };
  return { label: "Préparer ma première recherche", href, description: `Choisissez les intervenants pour « ${mission.name} », puis lancez l’envoi.` };
}

// Registration fields are deliberately excluded: a fresh account starts at 0/4.
export function activationSteps(summary, whatsapp, quota) {
  if (!summary?.activation) return [];
  const next = activationNext(summary, whatsapp, quota);
  return [
    { id: "mission", shortLabel: "Créer une mission", label: "Créer votre première mission", done: summary.missions_total > 0, href: "/app/missions/new" },
    { id: "workers", shortLabel: "Ajouter l’équipe", label: "Ajouter vos intervenants", done: summary.activation.active_workers > 0, href: "/app/workers?add=1" },
    { id: "whatsapp", shortLabel: "Relier WhatsApp", label: whatsapp ? "Connecter WhatsApp" : "Vérifier la connexion WhatsApp", done: !!whatsapp?.connected, href: "/app/workers?connect=1" },
    { id: "invite", shortLabel: "Envoyer la demande", label: "Envoyer votre première demande", done: !!summary.activation.first_invite_sent, href: next?.connect ? "/app/workers?connect=1" : next?.href || "/app/dashboard" },
  ];
}
