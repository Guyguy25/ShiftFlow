# ShiftFlow – feuille de route « outil quotidien » (24/10/2026)

**Séparer le changement de prix des fonctionnalités lourdes.** La PR de pricing ne prétend pas livrer des capacités qui n'existent pas : elle sécurise le nouveau modèle économique avant des évolutions produit dans des branches et tests dédiés.

## Déjà dans le produit
- Missions et créneaux multi-jours, équipes, carnet d'intervenants et compétences, recherche/import WhatsApp.
- Cascades d'invitations, confirmations, annulations, rappels et suivi des places manquantes.
- Calendrier des missions et tableau de bord des missions à risque.
- Déclarations d'heures sans compte intervenant, validation/rejet et exports (voir `backend/timesheets.py`, `frontend/src/pages/Hours.js`). **Ne pas réinventer ces fonctions.**
- Paiement propriétaire commun à toutes les organisations, quotas mensuels Start/Pro et places Pro/Business.

## Lot A – Disponibilités et conflits (priorité produit n°1)

Ajouter une vue par intervenant (disponible / indisponible / non renseigné) pour un intervalle, avec plages horaires/absences, horodatage et propriétaire de l'information. Permettre à un intervenant de répondre à une sollicitation de disponibilité via **lien à durée limitée sans compte**, uniquement pour son propre profil, et de révoquer/mettre à jour son signalement. Consentement/contact et politique de conservation à préciser. Ne jamais rendre publiques les coordonnées du carnet.

Dans la préparation d'une mission : afficher les incompatibilités de dates et les doubles affectations confirmées (tenant-scoped) avant l'envoi des invitations ; ne pas marquer arbitrairement les disponibilités inconnues comme disponibles. Garder une possibilité d'override explicite du responsable en cas de conflit.

Critères d'acceptation : test de conflits sur missions multi-jours/décalage minuit et fuseau Europe/Paris, isolement entre organisations, jetons à usage limité, contrôle des accès, tests d'annulation et de modification des créneaux, aucune invitation WhatsApp sans action demandée par le responsable.

## Lot B – Planning et briefing par mission

Afficher une vue opérationnelle « équipe à compléter / confirmations / problèmes / à valider », préparer des missions brouillon sans contact automatique, partager un briefing via lien privé signé accessible aux intervenants confirmés avec dates, lieu, horaires, consignes et fichiers légers, sans exposer les autres intervenants.

Critères : édition cohérente avant/après confirmation avec avis sur les changements significatifs, expiration des liens, accès public limité par mission/intervenant, audit des changements d'horaires.

## Lot C – Consolidation après mission

Exploiter les **relevés d'heures existants** plutôt que créer un deuxième pointage. Ajouter un tableau multi-missions qui distingue heures planifiées/validées, écarts, rémunérations estimées/validées et exports par période ; montrer explicitement le caractère indicatif des calculs et les régimes cachet/brut/net.

Critères : aucune altération rétroactive des heures approuvées sans versionnement, tests des taux et pauses, export CSV protégé contre injection de formules, permissions propriétaire/coordinateur.

## Lot D – Affectation assistée et mobile

Suggestions de profils **explicables** selon métier, disponibilité déclarée, historique et priorité définie par l'organisateur, sans décision d'embauche entièrement automatique ni profilage opaque. L'organisateur choisit qui contacter ; la cascade conserve son rôle central.

Une PWA orientée responsables d'abord, avec notifications opt-in et liens directs vers les actions prioritaires. Envisager app native iOS/Android après vérification des règles Apple/Google et de la fiabilité WhatsApp.

## Mesure et ordre de lancement

Mesurer sans PII superflue : missions créées, utilisateurs activés, invitation envoyée, réussite cascade, conflits détectés, disponibilités déclarées, relevés d'heures validés, rétention à 30/60/90j et taux de clients payants. Segmenter par volume mensuel et saisonnalité, pas par taille d'entreprise seulement.

1. Déployer le nouveau pricing seulement **après** validation Whop réelle + tests + révision légale.
2. Interroger 5 à 10 utilisateurs qualifiés sur disponibilités et planning ; lancer le lot A.
3. Faire évoluer le briefing et consolider les heures (lots B/C).
4. Réévaluer les quotas/prix via conversion Start→Pro et annulations en basse saison, sans multiplier les packs tant que le besoin n'est pas validé.
