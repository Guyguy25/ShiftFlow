import React from "react";
import { Link } from "react-router-dom";

export default function FirstMissionHelp() {
  return <section className="my-5 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm" aria-label="Avant votre premier envoi">
    <h2 className="font-semibold text-gray-900">Vous gardez la main sur vos premiers envois</h2>
    <div className="mt-3 space-y-3 text-gray-700">
      <details><summary className="cursor-pointer font-medium">Quels contacts seront accessibles ?</summary><p className="mt-2 leading-relaxed">La connexion synchronise les noms et numéros des contacts disponibles dans votre WhatsApp pour vous permettre de les choisir. Seuls ceux que vous sélectionnez et importez sont ajoutés à votre liste d’intervenants. Vous pouvez aussi ajouter vos intervenants manuellement.</p></details>
      <details><summary className="cursor-pointer font-medium">Un message va-t-il partir immédiatement ?</summary><p className="mt-2 leading-relaxed">Créer votre compte, préparer une mission ou importer des contacts ne lance pas de demande. Vous vérifiez l’aperçu, puis confirmez l’envoi depuis la mission. Une fois la cascade lancée, les demandes suivantes et les rappels peuvent partir automatiquement. Reconnecter WhatsApp peut permettre la reprise d’automatisations déjà lancées.</p></details>
      <details><summary className="cursor-pointer font-medium">Puis-je voir le message avant envoi ?</summary><p className="mt-2 leading-relaxed">Oui. Dans votre mission, sélectionnez vos intervenants puis cliquez sur « Vérifier le message et les destinataires ». Vous verrez le message personnalisé pour chacun avant de confirmer. Le lien de réponse sera généré lors du lancement.</p></details>
      <details><summary className="cursor-pointer font-medium">Puis-je essayer sans solliciter de vrais intervenants ?</summary><p className="mt-2 leading-relaxed">Oui : la simulation utilise uniquement des personnages fictifs. Elle ne connecte pas WhatsApp, ne crée aucune mission et ne démarre pas votre essai de 30 jours.</p><Link to="/demo" className="mt-2 inline-flex min-h-11 items-center font-semibold text-blue-700 underline">Essayer la simulation sans envoi</Link></details>
    </div>
  </section>;
}
