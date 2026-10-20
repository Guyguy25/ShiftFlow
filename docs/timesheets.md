# Déclaration des heures (proposition en PR)

## Parcours utilisateur
1. Un organisateur ouvre **Suivi des heures** (menu, ou bouton dans une mission).
2. Une fois le créneau terminé, il envoie la demande aux **intervenants confirmés** par WhatsApp.
3. Chaque intervenant reçoit un lien aléatoire unique, sans inscription. Il confirme ou corrige ses horaires et saisit une pause.
4. L'organisateur voit le prévu, le déclaré et l'écart, peut **valider** ou **demander une correction** (notifiée par WhatsApp).
5. L'export CSV, accessible seulement au propriétaire de la mission, contient uniquement les déclarations validées. Les montants sont des **estimations**, jamais une instruction de paiement.

## Missions et rémunération
- Une déclaration est associée à une **affectation confirmée d'un intervenant à un créneau**. Une mission multijours produira une déclaration par créneau confirmé.
- Le calcul se fait sur des dates et heures ISO avec fuseau, avec prise en compte de la nuit (fin avant début = lendemain).
- Pause (minutes) déduite, durée bornée, et heures très éloignées du créneau rejetées côté serveur.
- Rémunération à l'heure : heures validées × taux de la mission. Cachet : montant fixe de la mission. La base brut/net existante est conservée.
- Une fois validée, la déclaration est en lecture seule ; les corrections nécessitent un rejet **avant** validation.

## Sécurité
- Lien public indépendant du lien d'acceptation de mission, généré via `secrets.token_urlsafe(32)`.
- Base MongoDB : empreinte SHA-256 du jeton ; aucun jeton en clair dans les documents timesheets ni dans le journal de notifications.
- Les liens expirent après 90 jours. Un renvoi de lien réussi invalide l'ancien lien. Conserver le lien privé : c'est un identifiant d'accès personnel.
- Pas d'accès public aux autres intervenants, aux taux de paie ni aux montants.
- API organisateur sur session authentifiée, avec filtre `agency_id` et vérification de la propriété de la mission.
- Validation et soumission conditionnelles par état et compteur de révision, avec journal d'événements. Index unique par affectation et index unique partiel/sparse par jeton.
- CSV protégé contre l'injection de formules.
- Les heures et validations ne constituent pas à elles seules un système légal de badgeuse/paie. Vérifier les obligations de transparence, rectification et conservation des données avant utilisation en production.

## Automatisations
Dans **Automatisations > Déclaration des heures**, l'envoi automatique est désactivé par défaut. En activant le réglage :
- Le cron existant `POST /api/cron/reminders` déclenche le traitement après fin de créneau (pas rétroactif aux missions déjà terminées avant l'activation).
- Seuls les intervenants confirmés sont contactés, avec au maximum une relance automatique (12, 24 ou 48 h, configurable) si les heures ne sont pas déclarées.
- Les tentatives sont protégées contre les doubles envois concurrents et les échecs sont visibles dans le journal WhatsApp.
- Le cron existant doit être exécuté régulièrement avec `Authorization: Bearer WEBHOOK_CRON_SECRET`. **Vérifier sa configuration Railway.**
- Une connexion WhatsApp active reste indispensable pour envoyer les messages ; un échec peut être réessayé depuis le suivi des heures.

## Vérifications avant fusion / production
1. Exécuter `python -m unittest discover -s backend/tests -p test_timesheets.py`.
2. Exécuter `CI=true yarn test --watch=false --runInBand` et `CI=true yarn build` depuis `frontend/`.
3. Tester un créneau 20h–02h et une mission avec plusieurs créneaux ; soumettre avec et sans pause.
4. Tester une demande de correction puis la validation ; vérifier les liens anciens invalidés et l'impossibilité de modifier après validation.
5. Tester une déconnexion WhatsApp, le renvoi limité, les exports CSV et une seconde agence (aucun accès aux données croisées).
6. Vérifier le cron Railway existant, les permissions MongoDB et l'URL FRONTEND_URL pointant vers le bon domaine.
7. Informer les entreprises/intervenants du traitement des heures et définir une durée de conservation.

Cette fonctionnalité **n'envoie pas de paiements** et ne calcule pas les majorations, primes ou réglementations de conventions collectives.
