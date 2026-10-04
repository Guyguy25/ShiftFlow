# Activation et liaison WhatsApp — 4 octobre 2026

## Audit

React/Tailwind côté interface ; FastAPI/MongoDB côté application ; Node/Baileys pour WhatsApp. L’inscription redirige déjà vers un accueil adapté aux non-activés. ActivationHome, AccountActivation, GettingStarted et le coach utilisent les données réelles. La création conserve la mission et le shift dans la destination. Le sélecteur propose ajout manuel/import, ordre de priorité, aperçu et confirmation explicite avant tout envoi. Le tutoriel reste accessible dans Aide.

Le premier envoi est identifié par une notification WhatsApp kind=invite/status=sent, y compris sur une mission archivée. Les événements existants sont dédupliqués par identifiant MongoDB agence:événement. La checklist flottante restait visible après activation. Les compteurs admin mission/intervenants utilisaient seulement les événements alors que les lignes utilisateurs exploitaient aussi les données historiques.

Baileys disposait de délais de transport/query de 60 s, d’une attente de préparation du code de 12 s et d’une reconnexion à 3 s. Aucun délai global n’arrêtait une liaison bloquée. Ceci explique la possibilité d’une attente sans fin ; cela ne prouve pas la cause précise d’une tentative particulière sans ses logs.

## Changements

- Checklist visible sur l’accueil avant premier envoi ; masquée après activation, même après une déconnexion.
- Prochaine action sans intervenants : ajout/import, avec destination mission conservée. Ajout réussi : vérification WhatsApp, puis connexion si nécessaire, puis retour à la mission pour aperçu et confirmation.
- Textes courts expliquant qui ajouter et pourquoi connecter WhatsApp.
- Délai global de liaison de 60 s, partagé entre reconnexions, uniquement pour une session non établie. QR successifs ne prolongent pas ce délai. Une session enregistrée restaurée ne reçoit pas ce timeout.
- À expiration : socket fermé, événements obsolètes invalidés, reconnexion arrêtée, QR supprimé, erreur publiée via status. Les credentials temporaires sont conservés jusqu’à la demande explicite de retry, puis nettoyés après les écritures déjà engagées. Une session établie/connectée n’est jamais nettoyée par ce chemin.
- Génération du code bornée à 15 s ; code d’une ancienne génération rejeté.
- Frontend : fin de l’attente/code à expiration, nouvelle demande possible ; même état retrouvé après refresh via status.
- Synchronisation échouée/déconnexion pendant import : erreur, pas tableau vide interprété comme succès. L’API Python refuse aussi une réponse de contacts non conforme.
- Admin : données historiques pour missions/intervenants ; invitations réellement envoyées récupérées par jointure notifications/missions. Un envoi prouve également la connexion WhatsApp passée. Pas de mutation rétroactive ni nouvel envoi analytics. Suppression des plafonds arbitraires de lecture dans cette route.
- Nouvel événement first_invite_accepted lors d’une acceptation réelle. Les événements existants restent inchangés.

## Événements

| Étape produit | Nom interne existant ou ajouté |
|---|---|
| Inscription | sign_up |
| Première mission | mission_created |
| Premier intervenant | worker_added |
| WhatsApp connecté | whatsapp_connected |
| Lancement demandé | cascade_started |
| Premier envoi réussi (activation) | first_cascade_sent ; dashboard : first_invite_sent |
| Première acceptation | first_invite_accepted (ajouté) |
| Équipe complète | mission_filled |

Pas d’alias ajouté pour éviter des doublons. FirstCascadeSent et WhatsAppConnected restent les noms Meta existants, soumis au consentement. Le nouvel événement d’acceptation est interne. Les ratios admin sont des rapports entre populations ayant atteint chaque jalon, pas une analyse de cohortes ordonnée chronologiquement. Les anciennes connexions sans événement ni envoi ne peuvent pas être reconstruites.

## Validation et limites

- 52 tests frontend : routes, activation existante, aperçu/confirmation, timeout mobile simulé et synchronisation en erreur.
- 4 tests Node : expiration, socket protégé après connexion, session établie protégée, délai non prolongé.
- 2 tests Python isolés : nouveau compte et invitation réelle dans historique archivé.
- Build React production réussi, syntaxe Python/Node vérifiée.
- Vérification visuelle navigateur non réalisée : Chromium absent et téléchargement du runtime invalide. Pas de compte de production créé, pas de WhatsApp réel connecté, pas de vraie invitation envoyée. Les tests simulés ne prouvent pas la liaison/livraison réelle ni l’absence de tous les problèmes visuels.

## Test manuel avant fusion/déploiement

1. Sur 390 px puis desktop : inscription → première mission → ajout manuel d’un intervenant → connexion WhatsApp → retour à la mission → priorité → aperçu → confirmation. Aucun message avant confirmation ; checklist disparaît après notification envoyée.
2. Import WhatsApp : sélectionner/importer les contacts ; retour à la mission ; confirmer explicitement l’envoi.
3. Générer QR/code sans finaliser : après 60 s, vérifier erreur et arrêt de l’attente ; rafraîchir : erreur conservée ; générer un nouveau QR/code et connecter.
4. Connexion réussie avant délai : patienter plus de 60 s ; session reste connectée. Tester aussi une session existante après redémarrage du service.
5. Simuler service de contacts en erreur : message d’erreur, aucune annonce de carnet vide réussi.
6. Rafraîchir entre mission, ajout, connexion et premier envoi : progression déduite des données persistantes.
7. Compte déjà activé : aucune checklist obligatoire, missions existantes disponibles.
8. Accepter via lien réel : first_invite_accepted unique ; mission_filled quand tous les shifts sont complets.

## Risques

Le délai part au premier QR/code disponible, donc un utilisateur lent peut devoir recommencer. Le déploiement redémarre le service et les sessions persistantes se restaurent selon le mécanisme existant ; prévoir une validation sur une session de test. Le fonctionnement Baileys réel doit être vérifié. La jointure admin peut nécessiter des index avec un volume important. Aucune migration ni modification de sessions existantes à exécuter.
