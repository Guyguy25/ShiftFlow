# Retours de Paul — missions et Automatisations — 15 octobre 2026

## Architecture et parcours livrés

React (`MissionCreate`, `MissionDetail`, `InvitationReview`, `Settings`) utilise FastAPI (`server.py`). MongoDB conserve missions, créneaux, invitations et journaux d’envoi. `whatsapp_routes.py` remplace les anciens envois SMS par le service Node/Baileys ; ces nouveaux parcours utilisent le même service et la session WhatsApp du compte propriétaire. `mission_operations.py` regroupe les actions de gestion et les notifications de changement, retrait et annulation.

- Avant confirmation des invitations : texte éditable, aperçu par destinataire et validation des variables/liens. La sélection et son texte sont persistés seulement lors de la confirmation. Les invitations différées/reprises de cette sélection utilisent ce même texte, même si le modèle global change ensuite.
- Paramètres > Automatisations : première invitation, relance sans réponse, annulation, retrait et modification de créneau. Tous les comptes peuvent consulter, modifier et restaurer chaque modèle indépendamment. L’ancien éditeur, ses variables et ses validations sont conservés.
- Ajout, modification et suppression de créneaux après création. Une diminution du besoin sous le nombre de confirmations est refusée. Les personnes contactées/confirmées reçoivent les changements. Les confirmations sont conservées lors d’une modification ; la notification les informe des nouvelles conditions, sans demander une nouvelle acceptation.
- Cachet fixe par personne et par créneau, avec choix obligatoire brut/net. Le tarif horaire reste disponible. Estimation, récapitulatif, page publique, aperçu WhatsApp et duplication reprennent le montant, l’unité et la base. Aucune conversion brut/net.
- Relance manuelle des statuts « demande envoyée » et « sans réponse », uniquement avant le début et si des places restent à confirmer. Le statut de réponse n’est pas forcé. Délai anti-double-clic : une heure entre deux relances réussies ; un échec est réessayable. La relance automatique existante utilise désormais le modèle de relance distinct.
- Retrait d’un confirmé : état annulé, motif conservé, besoin recalculé, notification. Le remplacement se fait explicitement depuis les invitations en attente ou une nouvelle sélection.
- Annulation de mission : tous les intervenants affectés sont notifiés, y compris les statuts en attente, refusé et sans réponse. Un intervenant présent sur plusieurs créneaux reçoit une notification pour chaque créneau. La suppression d’un créneau et l’archivage suivent aussi ce principe.
- Les échecs ne sont pas présentés comme une livraison réussie. Réessai des notifications de gestion depuis la mission ; reprise séparée des invitations en attente. Le journal conserve succès et erreurs.

## Données existantes, Pro et essai

Pas de migration destructive ni de réécriture globale des comptes. Absence de `pay_type` = horaire ; absence de `pay_basis` = non précisé. Aucun brut/net n’est déduit des anciennes valeurs. Les nouveaux champs sont ajoutés lors de l’enregistrement d’un créneau. La duplication conserve ces champs avec valeurs de repli pour les anciennes données.

`whatsapp_invite_template` reste le stockage canonique de l’invitation. Les anciens endpoints GET/PUT/DELETE `/whatsapp/message-template` restent utilisables. Les autres modèles sont stockés sous `whatsapp_templates`. Les valeurs absentes ou invalides utilisent le modèle par défaut sans écraser l’enregistrement existant. La variable `{tarif}` reste reconnue ; l’ancienne écriture `{tarif}€/h` (avec ou sans espaces) est rendue via `{remuneration}` pour éviter d’afficher un cachet comme un tarif horaire. Pour les autres formulations personnalisées, utiliser `{remuneration}` afin d’inclure unité et brut/net.

Le modèle d’essai actuel du dépôt est de trois missions offertes sans expiration, puis crédits par mission ou Pro. Les modifications d’une mission existante, ses nouveaux créneaux et les modèles ne consomment pas de nouveau crédit. Les achats, quotas, essais Stripe et droits Pro ne sont pas modifiés ; les modèles deviennent accessibles à tous. Une annulation/suppression ne rembourse pas une mission consommée.

Les créneaux supprimés sont conservés avec `deleted_at` pour les liens et le journal, mais exclus du planning retourné et des totaux. Les invitations annulées gardent `status_before_cancellation` et `cancelled_at`. Les anciens statuts déjà annulés ne sont pas reconstruits.

## Sécurité et livraison

Chaque mutation vérifie le compte propriétaire de la mission et du créneau. Les modèles sont propres au compte connecté. Le déclenchement manuel des relances automatiques est limité au compte connecté, contrairement à l’ancien déclenchement global. Le cron serveur conserve son fonctionnement existant.

Les messages restent limités à 500 caractères/10 lignes, variables reconnues et lien sécurisé unique ; les liens externes saisis dans le modèle sont refusés. Le remplacement des variables est effectué en une passe : les noms/descriptions contenant des accolades ne deviennent pas du code de modèle.

Une annulation est enregistrée avant l’appel WhatsApp. Les anciens tokens d’un intervenant retiré, d’un créneau supprimé ou d’une mission annulée ne permettent plus accepter/refuser. Les mises à jour des réponses vérifient aussi le statut lu, et le recalcul des statuts ne réactive pas une annulation.

Des marqueurs de livraison par invitation/type et un verrou temporaire de trois minutes empêchent les réessais simultanés ordinaires et les renvois après succès enregistré. Les échecs peuvent être repris sans réenvoyer aux destinataires dont le succès est enregistré. Un arrêt entre l’acceptation par WhatsApp et l’écriture du succès reste ambigu : Baileys ne fournit pas ici de garantie de livraison exactement une fois. Les modifications concurrentes d’un même créneau ne disposent pas d’un historique versionné/transactionnel complet ; prévoir une validation en préproduction des usages multi-onglets. Les confirmations simultanées à la dernière place restent une limite préexistante du calcul de capacité, à traiter séparément par réservation atomique ou transaction si cet usage est fréquent.

## Impact produit : priorités et hypothèses à mesurer

Ces appréciations reposent sur le retour de Paul et les parcours du dépôt, sans mesure de gain commercial ni étude de marché. Ces fonctions renforcent surtout activation et rétention. Elles ne remplacent pas une promesse claire, une démo courte et une liaison WhatsApp fiable pour acquérir des clients.

| Priorité | Demande | Effet attendu et limite |
|---|---|---|
| 1 | Message modifiable juste avant envoi, modèles ouverts à tous | Réduit la peur d’envoyer un texte inadapté à son équipe. Effet direct plausible sur premier envoi ; laisser l’envoi dans le parcours mission, sans imposer un détour dans les paramètres. |
| 1 | Relance sans réponse | Rend concret le gain de temps promis et aide à compléter une équipe. Fort argument de démo et de réutilisation ; respecter fréquence et destinataires pour préserver la confiance. |
| 2 | Créneaux modifiables après création | Supprime une impasse quand le planning change, sans recréer la mission. Très utile dès la première mission réelle et pour la rétention. |
| 2 pour les équipes au cachet | Cachet fixe brut/net | Peut lever une objection bloquante dans l’événementiel. Impact d’acquisition surtout pour ce segment, moins général qu’une relance ou qu’un envoi facile. |
| Indispensable à la fiabilité | Retrait et annulation avec notification | Évite qu’un intervenant se présente inutilement. Moins vendeur en acquisition initiale, essentiel à la confiance et à la rétention. |

Mesurer avec les jalons existants `mission_created`, `worker_added`, `whatsapp_connected`, `first_cascade_sent`, `first_invite_accepted`, `mission_filled` et les notifications réelles :

1. Part des nouveaux comptes qui envoient une vraie première invitation sous 24 h, délai médian jusqu’à cet envoi ; distinguer l’abandon à la liaison WhatsApp et celui à la revue du message.
2. Part des premières missions ayant une réponse puis une équipe complète ; délai de réponse après invitation/relance et nombre de relances. Comparer des cohortes comparables, sans attribuer causalement les résultats à une relance sur une simple corrélation.
3. Réutilisation à 7/30 jours et seconde mission. Interroger les prochains utilisateurs sur la modification des créneaux, la pertinence du tarif/cachet et les erreurs évitées.
4. Acquisition : suivi visite → inscription → premier envoi pour une démo montrant « personnaliser, envoyer, relancer ». Ne pas promettre de pourcentage d’amélioration avant d’avoir les données.

## Validation et passage en production

Résultat local : **94 tests React et 60 tests Python réussis**, compilation React/prérendu réussie et import de l’application FastAPI vérifié avec une configuration locale factice. Les tests d’intégration historiques qui appellent un serveur distant n’ont pas été lancés.

Tests automatisés : suite React complète, nouveaux tests d’API hors ligne avec routes réelles et requêtes MongoDB simulées par mongomock, régressions de facturation/activation/profil et compilation de production. Le fichier `backend/requirements-test.txt` décrit la dépendance de test supplémentaire. Les tests d’API isolent la configuration du serveur et ne connectent ni MongoDB de production ni WhatsApp réel.

Commandes de validation locale :

```powershell
# Depuis frontend (les options de découverte explicites servent à cet environnement Windows)
$env:CI='true'
npm test -- --watchAll=false --runInBand --testMatch '**/*.test.js' --testPathIgnorePatterns 'node_modules' --cacheDirectory .test-cache
npm run build

# Depuis la racine
$env:PYTHONPATH='backend;backend/tests'
python -m unittest test_mission_operations test_mission_billing test_activation_isolated test_profile_data test_return_visits test_return_feedback test_onboarding_emails_unit test_registration_draft test_activation_tracking
```

Avant production : sur un environnement de test et un WhatsApp dédié, vérifier à 390 px et sur ordinateur le cycle complet invitation personnalisée → acceptation → changement de créneau/cachet → relance → retrait → annulation, avec un compte à la mission et un compte Pro/essai Stripe. Tester le service déconnecté puis les reprises, deux onglets et une mission ancienne avec modèle personnalisé. Vérifier les liens déjà envoyés et le journal. Confirmer la réception réelle et le comportement des sessions Baileys ; les tests simulés ne prouvent pas ces points. Charger d’abord l’API compatible, puis l’interface. Ne pas revenir à une ancienne API après création de cachets fixes sans vérifier qu’elle les comprend.

Aucun déploiement de production, aucune modification de la base de production, aucun message WhatsApp réel. La livraison réelle, la revue visuelle en navigateur et les scénarios concurrents en préproduction restent à vérifier avant une confirmation explicite de déploiement.
