import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Zap } from "lucide-react";
import LegalFooter from "../components/LegalFooter";
import { LEGAL, LEGAL_VERSION } from "../constants/legal";

function LegalShell({ title, subtitle, children }) {
  return (
    <div className="min-h-screen bg-[#F8FAFC] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="max-w-5xl mx-auto px-5 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center"><Zap className="w-4 h-4 text-white" /></div>
            <span className="font-display font-bold">ShiftFlow</span>
          </Link>
          <Link to="/" className="inline-flex items-center gap-1.5 text-sm text-slate-600 hover:text-slate-950"><ArrowLeft className="w-4 h-4" /> Retour</Link>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-5 sm:px-6 py-12 sm:py-16">
        <div className="max-w-3xl">
          <div className="text-xs uppercase tracking-[0.18em] font-bold text-blue-700">Juridique</div>
          <h1 className="mt-3 text-3xl sm:text-5xl font-display font-bold tracking-tight">{title}</h1>
          <p className="mt-4 text-slate-600 leading-relaxed">{subtitle}</p>
          <p className="mt-3 text-xs text-slate-400">Version du {LEGAL_VERSION}</p>
        </div>
        <div className="legal-copy mt-10 bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm">{children}</div>
      </main>
      <footer className="border-t border-slate-200 bg-white py-8 px-5"><LegalFooter /><div className="mt-3 text-center text-xs text-slate-400">© 2026 ShiftFlow</div></footer>
    </div>
  );
}

export function LegalNotice() {
  return (
    <LegalShell title="Mentions légales" subtitle="Informations relatives à l'édition, à l'hébergement et à l'exploitation du service ShiftFlow.">
      <h2>1. Contact et publication</h2>
      <ul>
        <li>Email professionnel : <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a></li>
        <li>Téléphone de contact : <a href="tel:+33661139861">{LEGAL.phone}</a></li>
        <li>Directeur de la publication : {LEGAL.editorName}</li>
      </ul>
      <h2>2. Hébergement</h2>
      <p>Le front-end public de ShiftFlow est hébergé par :</p>
      <p><strong>{LEGAL.hostName}</strong><br />{LEGAL.hostAddress}</p>
      <p>Certains composants techniques du service peuvent être hébergés auprès d'autres prestataires mentionnés dans la Politique de confidentialité et le DPA.</p>
      <h2>3. Propriété intellectuelle</h2>
      <p>Sauf mention contraire, l'ensemble des éléments composant ShiftFlow, notamment les textes, interfaces, composants graphiques, logos, structure du service, bases de données et code applicatif, est protégé par les règles relatives à la propriété intellectuelle. Toute reproduction, représentation ou exploitation non autorisée est interdite.</p>
      <h2>4. Contact</h2>
      <p>Pour toute demande générale relative au service, contactez <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.</p>
    </LegalShell>
  );
}

export function Terms() {
  return (
    <LegalShell title="Conditions générales d'utilisation et de vente" subtitle="Conditions applicables à l'accès et à l'utilisation de ShiftFlow par des clients professionnels.">
      <h2>1. Objet</h2><p>Les présentes conditions générales d'utilisation et de vente (« CGUV ») encadrent l'accès au service SaaS ShiftFlow, destiné principalement aux professionnels de l'événementiel pour organiser des missions, gérer des intervenants et automatiser des relances via WhatsApp.</p>
      <h2>2. Clientèle professionnelle</h2><p>ShiftFlow est proposé pour un usage professionnel. En créant un compte, le client déclare agir pour les besoins de son activité professionnelle et disposer du pouvoir nécessaire pour engager l'entité au nom de laquelle il utilise le service.</p>
      <h2>3. Création et sécurité du compte</h2><p>Le client doit fournir des informations exactes et maintenir ses identifiants confidentiels. Il est responsable des actions réalisées depuis son compte, sauf preuve d'un accès frauduleux qui ne lui serait pas imputable. Tout incident de sécurité doit être signalé rapidement à {LEGAL.email}.</p>
      <h2>4. Fonctionnement du service</h2><p>ShiftFlow permet notamment de créer des missions, gérer une liste d'intervenants, définir un ordre de priorité, envoyer des messages via le compte WhatsApp connecté du client, suivre les réponses et déclencher des relances automatiques selon les fonctionnalités disponibles.</p><p>Certaines fonctionnalités dépendent de services tiers, notamment WhatsApp, les infrastructures d'hébergement et le prestataire de paiement. ShiftFlow ne garantit pas la disponibilité continue de ces services tiers et peut adapter une intégration si un fournisseur modifie son fonctionnement.</p>
      <h2>5. Offre gratuite</h2><p>L'offre gratuite permet actuellement d'utiliser jusqu'à 1 mission active et 10 intervenants, sans carte bancaire. ShiftFlow peut faire évoluer les limites de l'offre gratuite, sous réserve de ne pas facturer rétroactivement un usage déjà réalisé.</p>
      <h2>6. Offre Pro</h2><p>L'offre Pro est proposée au tarif affiché sur la page Tarifs au moment de la souscription. À la date de la présente version, le prix public est de <strong>49 € par mois</strong>. Lorsque la franchise en base de TVA est applicable, la TVA n'est pas facturée conformément à l'article 293 B du CGI.</p><p>L'abonnement est renouvelé automatiquement par périodes mensuelles jusqu'à résiliation. Le client peut résilier depuis le portail de gestion d'abonnement. La résiliation prend effet à l'issue de la période déjà payée, sauf disposition impérative contraire.</p>
      <h2>7. Paiement, retard et recouvrement</h2><p>Les paiements en ligne sont traités par Stripe. Les sommes dues sont payables à l'échéance indiquée lors de la souscription ou sur la facture. Aucun escompte n'est accordé pour paiement anticipé.</p><p>En cas de retard de paiement entre professionnels, des pénalités sont exigibles de plein droit dès le jour suivant l'échéance, sans rappel préalable, au taux de la Banque centrale européenne applicable à son opération de refinancement la plus récente majoré de 10 points de pourcentage, ainsi qu'une indemnité forfaitaire de 40 € pour frais de recouvrement. Une indemnisation complémentaire peut être demandée sur justificatifs lorsque les frais exposés sont supérieurs.</p>
      <h2>8. Remboursements</h2><p>Sauf erreur de facturation, double paiement, indisponibilité imputable à ShiftFlow ouvrant droit à restitution, ou obligation légale contraire, les périodes d'abonnement commencées ne sont pas remboursées au prorata. La résiliation évite le renouvellement suivant et laisse l'accès actif jusqu'à la fin de la période payée.</p>
      <h2>9. Utilisation autorisée</h2><p>Le client s'engage notamment à ne pas :</p><ul><li>utiliser ShiftFlow pour envoyer des messages illicites, frauduleux, trompeurs ou non sollicités en violation des règles applicables ;</li><li>tenter de contourner les limites techniques, de sécurité ou de facturation ;</li><li>porter atteinte aux droits de tiers ou aux conditions d'utilisation des services intégrés ;</li><li>introduire des contenus malveillants ou tenter d'accéder aux données d'autres clients.</li></ul>
      <h2>10. Données des intervenants</h2><p>Le client reste responsable de la licéité de la collecte et de l'utilisation des données de ses intervenants ainsi que de l'information de ces derniers. Lorsque ShiftFlow traite ces données pour le compte du client, les dispositions du DPA font partie intégrante du contrat.</p>
      <h2>11. Disponibilité, maintenance et évolutions</h2><p>ShiftFlow met en œuvre des moyens raisonnables pour maintenir le service disponible et sécurisé. Des interruptions peuvent survenir pour maintenance, incident, mise à jour, force majeure ou défaillance d'un prestataire tiers. Les fonctionnalités peuvent évoluer afin d'améliorer le service ou de répondre à des contraintes techniques, légales ou de sécurité.</p>
      <h2>12. Responsabilité</h2><p>ShiftFlow est un outil d'organisation et d'automatisation et ne garantit pas qu'un intervenant acceptera une mission, répondra à un message ou se présentera effectivement. Le client demeure responsable de ses décisions opérationnelles, de ses relations avec ses intervenants et de la vérification des informations critiques.</p><p>Dans les limites autorisées par la loi et pour les clients professionnels, ShiftFlow ne répond pas des dommages indirects, pertes de chiffre d'affaires, pertes de chance, pertes de données imputables au client ou indisponibilités provenant exclusivement d'un service tiers hors de son contrôle raisonnable.</p>
      <h2>13. Suspension et résiliation</h2><p>ShiftFlow peut suspendre l'accès en cas d'impayé, d'usage manifestement illicite, d'atteinte à la sécurité ou de violation grave des présentes conditions, lorsque la situation le justifie. Lorsque cela est raisonnablement possible, le client est informé avant une suspension non urgente.</p>
      <h2>14. Modification des conditions</h2><p>Les CGUV peuvent être modifiées pour tenir compte de l'évolution du service, de la réglementation ou des pratiques commerciales. Les changements substantiels applicables à un abonnement en cours sont portés à la connaissance du client dans un délai raisonnable.</p>
      <h2>15. Droit applicable et litiges</h2><p>Les présentes conditions sont soumises au droit français. Les parties s'efforcent de résoudre amiablement tout différend avant action judiciaire. Pour les litiges entre professionnels, les règles de compétence juridictionnelle applicables sont celles prévues par le droit français.</p>
      <h2>16. Documents contractuels</h2><p>Les présentes CGUV, la Politique de confidentialité et, lorsque ShiftFlow agit comme sous-traitant de données personnelles, le DPA constituent ensemble le cadre contractuel applicable au service.</p>
    </LegalShell>
  );
}

export function Privacy() {
  return (
    <LegalShell title="Politique de confidentialité" subtitle="Comment ShiftFlow traite les données personnelles liées aux comptes, aux intervenants et à l'utilisation du service.">
      <h2>1. Responsable du traitement</h2><p>Pour les traitements liés à la gestion des comptes clients, à la facturation, au support, à la sécurité et au fonctionnement du service, le responsable du traitement est l'éditeur de ShiftFlow identifié dans les <Link to="/mentions-legales">mentions légales</Link>. Le contact privilégié pour les demandes de confidentialité est <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.</p>
      <h2>2. Données traitées</h2><p>Selon l'utilisation du service, ShiftFlow peut traiter notamment :</p><ul><li>identité et coordonnées du titulaire du compte : nom, agence, email, téléphone ;</li><li>données d'authentification et données techniques de session ;</li><li>données liées aux missions : nom, lieu, dates, horaires, besoins et informations opérationnelles ;</li><li>données relatives aux intervenants ajoutés par le client : nom, prénom, téléphone, email, compétences, notes et statut de mission ;</li><li>journaux techniques et historiques d'envoi nécessaires au suivi du service ;</li><li>données de facturation et d'abonnement transmises ou générées par Stripe ;</li><li>échanges avec le support.</li></ul>
      <h2>3. Finalités et bases juridiques</h2><ul><li><strong>Fourniture du service, compte et abonnement :</strong> exécution du contrat.</li><li><strong>Facturation et obligations comptables :</strong> obligation légale et exécution du contrat.</li><li><strong>Sécurité, prévention des abus et journalisation :</strong> intérêt légitime à protéger le service et ses utilisateurs.</li><li><strong>Support :</strong> exécution du contrat et intérêt légitime à traiter les demandes.</li><li><strong>Amélioration du produit :</strong> intérêt légitime, à partir de données limitées à ce qui est nécessaire.</li></ul>
      <h2>4. Données des intervenants</h2><p>Lorsqu'une agence cliente ajoute les données de ses intervenants et utilise ShiftFlow pour les contacter ou suivre leur réponse, l'agence détermine en principe la finalité de ce traitement. ShiftFlow agit alors comme sous-traitant pour le compte de l'agence selon le DPA.</p>
      <h2>5. Destinataires et prestataires</h2><p>Les données sont accessibles uniquement aux personnes et prestataires qui en ont besoin pour fournir, sécuriser ou facturer le service. Les catégories de prestataires comprennent notamment l'hébergement de l'application, l'hébergement du back-end et du service WhatsApp, la base de données, le paiement et les services de messagerie intégrés.</p><p>Les prestataires actuellement utilisés peuvent inclure Vercel, Railway, MongoDB, Stripe et les services WhatsApp/Meta nécessaires au fonctionnement choisi par le client. Cette liste peut évoluer ; les sous-traitants pertinents pour les données confiées par les clients sont également décrits dans le DPA.</p>
      <h2>6. Transferts hors Espace économique européen</h2><p>Certains prestataires peuvent traiter des données depuis des pays situés hors de l'Espace économique européen. Lorsque le RGPD l'exige, ShiftFlow s'appuie sur un mécanisme de transfert reconnu, tel qu'une décision d'adéquation ou des clauses contractuelles types, ainsi que sur les garanties proposées par le prestataire concerné.</p>
      <h2>7. Durées de conservation</h2><ul><li><strong>Compte actif :</strong> pendant la durée d'utilisation du service.</li><li><strong>Données opérationnelles :</strong> pendant la durée du compte et aussi longtemps qu'elles restent utiles au client, sauf suppression demandée ou obligation contraire.</li><li><strong>Données de facturation :</strong> pendant les durées imposées par les obligations comptables et fiscales applicables.</li><li><strong>Journaux de sécurité :</strong> pendant une durée proportionnée aux besoins de sécurité et d'investigation.</li><li><strong>Demandes de support :</strong> pendant le temps nécessaire au traitement puis à la défense d'éventuels droits.</li></ul>
      <h2>8. Sécurité</h2><p>ShiftFlow met en œuvre des mesures techniques et organisationnelles adaptées au risque, notamment authentification, contrôle des accès, séparation logique des comptes, chiffrement des communications, journalisation utile à la sécurité et restrictions d'accès aux environnements de production.</p>
      <h2>9. Vos droits</h2><p>Selon le traitement concerné, vous pouvez disposer de droits d'accès, de rectification, d'effacement, de limitation, d'opposition et de portabilité, ainsi que du droit de retirer un consentement lorsqu'il constitue la base du traitement.</p><p>Pour exercer un droit : <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>. Une vérification raisonnable de l'identité peut être demandée lorsque cela est nécessaire. Vous pouvez également saisir la CNIL si vous estimez que vos droits ne sont pas respectés.</p>
      <h2>10. Mise à jour</h2><p>Cette politique peut être mise à jour pour refléter l'évolution du service, des prestataires ou des obligations légales.</p>
    </LegalShell>
  );
}

export function Cookies() {
  return (
    <LegalShell title="Politique relative aux cookies" subtitle="Informations sur les cookies et traceurs utilisés par ShiftFlow.">
      <h2>1. Cookies actuellement nécessaires au service</h2><p>ShiftFlow utilise des cookies techniques d'authentification nécessaires au maintien de la session utilisateur et à la sécurité du compte. Ces cookies sont indispensables au fonctionnement du service et ne servent pas à établir un profil publicitaire.</p>
      <h2>2. Traceurs publicitaires et mesure d'audience</h2><p>À la date de la présente version, aucun code Meta Pixel, Google Analytics, Google Ads ou autre traceur marketing n'a été identifié dans le code public de l'application. En conséquence, ShiftFlow n'affiche pas actuellement de bannière de consentement marketing qui serait sans objet.</p><p>Si des traceurs non strictement nécessaires sont ajoutés ultérieurement, ils ne devront être déposés qu'après recueil du consentement lorsque la réglementation l'exige, avec une possibilité de refus aussi simple que l'acceptation et un mécanisme permettant de modifier son choix.</p>
      <h2>3. Gestion des cookies</h2><p>Vous pouvez supprimer les cookies depuis les paramètres de votre navigateur. La suppression des cookies d'authentification peut entraîner votre déconnexion de ShiftFlow.</p>
      <h2>4. Contact</h2><p>Pour toute question relative aux cookies : <a href={`mailto:${LEGAL.email}`}>{LEGAL.email}</a>.</p>
    </LegalShell>
  );
}

export function DPA() {
  return (
    <LegalShell title="Accord de traitement des données (DPA)" subtitle="Clauses applicables lorsque ShiftFlow traite des données personnelles pour le compte d'une agence cliente.">
      <h2>1. Parties et rôle</h2><p>Le présent accord de traitement des données (« DPA ») complète les CGUV. L'agence cliente agit comme <strong>responsable du traitement</strong> pour les données personnelles qu'elle importe ou saisit dans ShiftFlow pour gérer ses intervenants. ShiftFlow, exploité par l'éditeur identifié dans les mentions légales, agit comme <strong>sous-traitant</strong> lorsqu'il traite ces données uniquement pour fournir le service selon les instructions du client.</p>
      <h2>2. Objet, durée, nature et finalités</h2><ul><li><strong>Objet :</strong> gestion opérationnelle des intervenants et missions dans ShiftFlow.</li><li><strong>Durée :</strong> durée du contrat et, après sa fin, durée strictement nécessaire à la restitution, suppression ou obligations légales applicables.</li><li><strong>Nature :</strong> collecte par saisie/import, stockage, consultation, organisation, transmission de messages, suivi des réponses, journalisation et suppression.</li><li><strong>Finalités :</strong> gestion de missions, sélection d'intervenants, envoi de demandes et rappels, suivi de confirmation et organisation opérationnelle.</li></ul>
      <h2>3. Catégories de personnes et de données</h2><p><strong>Personnes concernées :</strong> intervenants, prestataires, techniciens, monteurs, chefs d'équipe et autres personnes ajoutées par le client.</p><p><strong>Données :</strong> identité, coordonnées, compétences, notes opérationnelles, affectations à des missions, réponses, statuts de confirmation et journaux d'envoi.</p>
      <h2>4. Instructions du client</h2><p>ShiftFlow traite les données uniquement sur instructions documentées du client, telles qu'elles résultent de l'utilisation des fonctionnalités du service et du présent contrat. Si ShiftFlow estime qu'une instruction viole le RGPD ou une autre règle applicable en matière de protection des données, il en informe le client dans la mesure permise par la loi.</p>
      <h2>5. Confidentialité</h2><p>Les personnes autorisées à traiter les données sont soumises à une obligation de confidentialité appropriée et n'accèdent qu'aux données nécessaires à leurs fonctions.</p>
      <h2>6. Sécurité</h2><p>ShiftFlow met en œuvre des mesures techniques et organisationnelles proportionnées au risque, incluant notamment contrôle des accès, authentification, protection des communications, séparation logique des données, limitation des accès administratifs, sauvegardes ou mécanismes de résilience appropriés, suivi des incidents et mises à jour de sécurité raisonnables.</p>
      <h2>7. Sous-traitants ultérieurs</h2><p>Le client autorise de manière générale le recours à des sous-traitants ultérieurs nécessaires à la fourniture du service. Les catégories et prestataires susceptibles d'être concernés comprennent notamment :</p><ul><li>Vercel : hébergement et diffusion du front-end ;</li><li>Railway : hébergement de services back-end et composants associés ;</li><li>MongoDB : infrastructure de base de données selon l'environnement déployé ;</li><li>Stripe : paiement et gestion de l'abonnement ;</li><li>WhatsApp / Meta et les composants techniques associés : transmission des messages lorsque le client connecte son compte WhatsApp.</li></ul><p>ShiftFlow impose aux sous-traitants ultérieurs des obligations de protection des données appropriées lorsqu'ils traitent effectivement des données pour son compte. En cas de changement significatif de sous-traitant susceptible d'affecter les données confiées par le client, ShiftFlow peut mettre à jour la présente liste et informer les clients concernés par un moyen approprié.</p>
      <h2>8. Assistance au client</h2><p>Compte tenu de la nature du traitement, ShiftFlow aide raisonnablement le client à répondre aux demandes d'exercice de droits, aux analyses de risques, aux demandes d'autorités et aux obligations relatives à la sécurité, dans la mesure où les informations sont disponibles auprès de ShiftFlow.</p>
      <h2>9. Violation de données</h2><p>En cas de violation de données personnelles affectant des données traitées pour le compte du client, ShiftFlow informe le client dans les meilleurs délais raisonnables après en avoir pris connaissance et lui communique les informations disponibles utiles à l'évaluation de l'incident.</p>
      <h2>10. Sort des données à la fin du contrat</h2><p>À la fin du service, ShiftFlow supprime ou restitue les données personnelles traitées pour le compte du client selon les capacités du service, sauf lorsqu'une conservation limitée est imposée par la loi ou nécessaire à la défense de droits. Les sauvegardes résiduelles sont supprimées selon le cycle normal de rétention applicable.</p>
      <h2>11. Documentation et audit</h2><p>ShiftFlow met à disposition les informations raisonnablement nécessaires pour démontrer le respect de ses obligations de sous-traitant. Les demandes d'audit doivent être proportionnées, annoncées à l'avance, préserver la confidentialité et ne pas compromettre la sécurité des autres clients.</p>
      <h2>12. Transferts internationaux</h2><p>Lorsque des données sont transférées hors de l'Espace économique européen et qu'un mécanisme de transfert est requis, ShiftFlow ou le prestataire concerné met en place un mécanisme reconnu par le RGPD, tel qu'une décision d'adéquation ou des clauses contractuelles types.</p>
      <h2>13. Priorité</h2><p>En cas de contradiction entre le présent DPA et les CGUV sur une question exclusivement liée au traitement de données personnelles pour le compte du client, le DPA prévaut sur ce point.</p>
    </LegalShell>
  );
}
