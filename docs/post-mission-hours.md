# Déclaration des heures après mission

## Structure et intégration

Le dépôt existant utilise React/CRA, FastAPI/Motor/MongoDB et une passerelle WhatsApp par compte organisateur. Une mission contient plusieurs créneaux (`shifts`) ; chaque affectation (`mission_workers`) rattache un intervenant à un créneau et possède son état de confirmation. Les permissions existantes sont celles d'un compte agence (`agency_id = user.id`), sans système de rôles collaboratifs au sein d'une agence.

La fonctionnalité suit cette structure : **une déclaration par affectation confirmée et par créneau terminé**, et non une déclaration globale ambiguë pour toutes les journées de la mission. Les déclarations de plusieurs créneaux sont regroupées et filtrables dans l'écran Heures. Un même créneau peut également couvrir plusieurs dates et contenir plusieurs périodes déclarées.

## Changements exacts

- `backend/hours_domain.py` : calcul des durées réelles en UTC, interprétation dans `MISSION_TIMEZONE` (Europe/Paris par défaut), nuits, dates de fin explicites, pauses non rémunérées, périodes multiples, non-chevauchement, changements d'heure et arrondi monétaire au centime avec Decimal.
- `backend/timesheets.py` : routes de déclaration sans compte, contrôle d'appartenance à l'agence, décisions organisateur, historique, renouvellement des liens, export CSV, réglages et traitement des envois/relances WhatsApp.
- `backend/server.py` : branchement du routeur et du traitement au webhook existant `/api/cron/reminders` ; index de lecture de la nouvelle collection ; champs facultatifs `end_date` et `break_minutes` sur les créneaux, contrôle de leur cohérence et conservation à la duplication ; date de fin agrégée et données publiques enrichies. Les estimations historiques sans les nouveaux champs conservent leur comportement ; les nouvelles estimations serveur tiennent compte des pauses et des dates de fin.
- `backend/whatsapp_routes.py` : date de fin explicite dans la variable d'horaire de fin des invitations personnalisées.
- `frontend/src/pages/PublicHours.js` : formulaire mobile sans compte, identité affichée, prévu prérempli, modification des périodes et pauses, commentaire, soumission et affichage de l'état/motif. Les heures répétées à l'automne disposent d'un choix d'occurrence.
- `frontend/src/pages/Hours.js` : filtres mission/statut, envoi manuel, relances, comparaison prévu/déclaré, validation/refus/correction motivée, historique avec les versions soumises, indicateurs validés et CSV, réglages par agence.
- Navigation bureau/mobile et accès depuis le détail d'une mission ; champs partagés de création/modification de créneau ; affichage de la date de fin et de la pause dans l'invitation publique.
- Confidentialité : liens en fragment (`/hours#…`), jetons envoyés à l'API dans le corps POST ; absence de corps de message, numéro et lien dans les notifications partagées d'heures. Pixel Meta et chargement initial des analytics Vercel désactivés sur la page publique d'heures. En-têtes no-store/no-referrer/noindex pour les pages et API concernées, et entrée statique de secours pour `/hours` et `/app/hours`.
- Tests API et React dédiés. Deux assertions de la démo existante sont mises à jour vers son intitulé déjà présent sur main (« Montage de scène · équipe road »).

## Parcours et états

1. L'organisateur ouvre **Mission → Gérer les heures**, choisit une mission puis demande les heures. Les intervenants non confirmés et les créneaux non terminés sont ignorés. La page indique les envois, échecs et éléments ignorés.
2. Une déclaration est créée une seule fois à partir du créneau. Le nom, le prévu, le fuseau et les conditions de rémunération sont figés à cette création, pour préserver la cohérence d'une déclaration déjà envoyée si le créneau est ensuite modifié.
3. WhatsApp envoie un lien personnel à l'intervenant. Le formulaire l'identifie à partir de son affectation, sans lui demander de sélectionner son nom ni de créer un compte.
4. `pending → submitted` : l'intervenant soumet ses périodes (1 à 100, maximum 31 jours cumulés), ses pauses et son commentaire. Les heures futures, périodes inversées, chevauchements, pauses incohérentes et heures inexistantes au printemps sont refusés. La déclaration soumise devient en lecture seule.
5. `submitted → approved / rejected / correction_requested` : seul le compte organisateur propriétaire décide. Le refus et la demande de correction nécessitent un motif. Une correction réouvre le formulaire et envoie un nouveau lien, en invalidant le précédent.
6. Une déclaration approuvée ou refusée peut être réouverte par **Demander une correction**, avec motif. Elle quitte alors les totaux validés jusqu'à une nouvelle soumission et validation. Les anciennes versions restent dans l'historique.

L'historique est mis à jour dans le même document atomique que chaque soumission/décision. Un numéro de version évite d'écraser une modification provenant d'un autre onglet. Le serveur vérifie que l'affectation, l'intervenant, le créneau, la mission et l'agence correspondent encore. Une annulation, un retrait ou une suppression de l'intervenant bloque l'accès au formulaire ; les données historiques déjà enregistrées restent visibles dans le dashboard de l'agence.

## Liens et permissions

Le jeton est une signature HMAC-SHA256 distincte des jetons d'invitation et d'authentification, fondée sur `JWT_SECRET`, l'identifiant d'affectation et un nonce aléatoire. Il est vérifié en temps constant, expire, et peut être renouvelé. La base conserve le nonce, pas un lien porteur directement réutilisable. Changer `JWT_SECRET` invalide les liens existants.

Le lien est un secret porteur : une personne à qui il est transféré peut agir pour cette affectation. Il ne prouve pas à lui seul que l'auteur est le propriétaire du numéro WhatsApp ; ne pas présenter ce mécanisme comme une signature d'identité. L'écran rappelle de ne pas partager le lien. Les journaux de reverse proxy et d'observabilité doivent exclure les corps de ces requêtes POST. Les journaux du fournisseur WhatsApp restent sous sa propre politique.

Les écritures et exports organisateur sont toujours limités à leur agence. Un autre compte, y compris propriétaire de sa propre agence, ne peut ni consulter, ni décider, ni renouveler, ni exporter ces déclarations. Les champs sensibles du jeton sont absents des réponses du dashboard et de l'historique.

## Rémunération et export

- Tarif horaire : minutes effectives moins pauses, multipliées par le tarif figé ; calcul et arrondi effectués côté serveur.
- Cachet : montant fixe par affectation/créneau, quelle que soit la durée déclarée ; il ne devient pas un tarif horaire ni un cachet par période ajoutée.
- Les totaux validés séparent brut, net et base non précisée. Aucune conversion brut/net n'est inventée.
- L'export suit les filtres actifs et contient tous les états si aucun filtre n'est choisi. **Filtrer sur Validée** pour préparer une liste de montants approuvés. Une ligne par période ; les totaux de déclaration ne sont renseignés que sur sa première ligne pour éviter les doubles sommes. UTF-8 avec BOM, séparateur point-virgule, guillemets CSV et protection contre l'injection de formules.
- Plafond de lecture/export de 10 000 déclarations : au-delà, une erreur demande de filtrer au lieu de produire silencieusement un résultat incomplet.
- Montants indicatifs hors charges/frais. Aucune paie, aucun paiement, aucun changement de la facturation d'abonnement ou de crédits de mission.

## Envois et relances

Par défaut, l'envoi automatique est **désactivé**. Les envois manuels sont disponibles. Réglages par agence : délai après fin 0–168 h (défaut 1), intervalle de relance 1–720 h (48), maximum de relances 0–10 (2), validité des nouveaux liens 1–90 jours (30).

Le webhook de rappels existant, protégé par `WEBHOOK_CRON_SECRET`, traite également les heures ; aucun second ordonnanceur n'est nécessaire. Il doit être appelé régulièrement, par exemple toutes les 15 minutes. La déduplication `X-Webhook-Id` préexistante est conservée : utiliser un identifiant différent à chaque exécution et le même lors d'une reprise du même appel.

L'activation automatique inclut les anciennes missions terminées **non archivées**, ce qui est indiqué avant l'enregistrement du réglage. Les missions annulées/archivées sont exclues du traitement automatique. Les relances cessent après soumission/refus/validation et ne dépassent pas leur plafond. Un échec ne consomme pas une relance réussie ; le traitement automatique espace ses reprises d'au moins 15 minutes. Un lien expiré doit être renouvelé explicitement par l'organisateur. Ce renouvellement invalide l'ancien lien, réinitialise son compteur d'envoi et envoie le nouveau.

Les envois utilisent une réservation atomique de cinq minutes et un compteur pour empêcher les doublons concurrents. Une décision reste enregistrée même si son message de correction échoue ; le dashboard affiche l'échec et permet la reprise. Comme la passerelle actuelle ne fournit pas de clé d'idempotence fournisseur, une coupure **après acceptation par WhatsApp et avant enregistrement en base** peut rendre un envoi ambigu et produire un doublon à la reprise. Il ne faut pas promettre une livraison exactement une fois.

## Validation avant production

La validation automatisée utilise des données fictives et des envois WhatsApp simulés. Les suites historiques qui appellent directement un serveur distant et ses services de facturation ne sont pas lancées. Le navigateur local utilise également des réponses API simulées : il valide le rendu et les interactions, pas la connexion réelle au fournisseur.

Résultats locaux du 20 octobre 2026 : **84 tests Python réussis**, **115 tests React réussis (21 suites)**, compilation React et prérendu réussis, import de l'application API avec configuration factice réussi. Recette navigateur : formulaire mobile et soumission, dashboard organisateur à 1440 px et 390 px, sans débordement horizontal ni erreur JavaScript. Aucun appel aux services de production pendant ces vérifications.

Commandes hors ligne, depuis la racine du dépôt (PowerShell) :

```powershell
$env:PYTHONPATH='backend;backend/tests'
python -m unittest test_timesheets test_mission_operations test_mission_billing test_subscription_billing test_activation_isolated test_profile_data test_return_visits test_return_feedback test_onboarding_emails_unit test_registration_draft test_activation_tracking
cd frontend
npm test -- --watchAll=false --runInBand --testMatch '**/*.test.js'
npm run build
```

Recette obligatoire sur un environnement de test isolé avant toute mise en production :

1. Vérifier `FRONTEND_URL` en HTTPS, `MISSION_TIMEZONE`, stabilité de `JWT_SECRET`, droits de création d'index MongoDB et appel régulier du webhook authentifié. Vérifier que les liens pointent vers l'environnement attendu.
2. Avec un compte agence, une mission terminée et un WhatsApp dédié : confirmer plusieurs intervenants, demander les heures et vérifier la réception réelle, le bon destinataire et l'identité affichée sans compte. Aucun message pour les non-confirmés ou créneaux futurs.
3. Tester une nuit, une mission avec plusieurs créneaux et un créneau multi-jours avec pauses. Modifier une période, soumettre, corriger, resoumettre et valider. Comparer durée et montant avec un calcul indépendant, à l'heure puis au cachet, brut puis net.
4. Vérifier le formulaire sur téléphone, une heure inexistante au printemps et les deux occurrences d'une heure à l'automne. Les horaires saisis sont ceux du fuseau indiqué, quel que soit le fuseau du téléphone.
5. Ouvrir deux onglets et tenter deux décisions/soumissions simultanées. Contrôler le conflit de version, l'historique conservé, l'accès refusé depuis une autre agence et les totaux retirés lorsqu'une validation est réouverte.
6. Déconnecter WhatsApp puis demander une correction. Vérifier que la décision reste enregistrée, que l'échec apparaît, que la reprise fonctionne et que l'ancien lien ne fonctionne plus. Tester expiration et renouvellement ; annuler/retirer un intervenant et vérifier le blocage de son lien.
7. Activer les relances sur une agence de test en maîtrisant son stock de missions anciennes ; contrôler le délai après fin, l'intervalle, le plafond, l'arrêt à la soumission et les journaux de l'ordonnanceur.
8. Exporter les déclarations validées, vérifier accents et cellules de commentaire commençant par `=`, puis additionner minutes/montants sans compter deux fois les périodes. Confirmer l'absence de liens personnels dans l'export et les notifications partagées.

La collection `timesheets` est additive et utilise l'identifiant d'affectation comme `_id` unique. Les index supplémentaires sont créés au démarrage. Aucune migration destructive ni réécriture des confirmations existantes. Déployer l'API compatible avant l'interface lors d'une mise en production ultérieure autorisée ; conserver la collection et les nouveaux champs en cas de retour arrière, et désactiver d'abord les envois automatiques. Aucune politique automatique de suppression des historiques n'est introduite.

Aucun déploiement ni message réel n'a été effectué pour cette livraison.
