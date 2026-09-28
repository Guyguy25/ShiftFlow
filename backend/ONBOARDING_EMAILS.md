# Emails de démarrage ShiftFlow

Le backend FastAPI vérifie les comptes à chaque passage du planificateur Railway existant (`POST /api/cron/reminders`, environ toutes les 15 minutes). Aucun second cron ou abonnement payant n'est requis. Les emails sont **désactivés par défaut**.

## Activer l'envoi

1. Créer un compte gratuit sur [Resend](https://resend.com/), puis ajouter et vérifier le domaine `shiftflow.io` dans Domains. Reporter uniquement les enregistrements DNS **indiqués par Resend**, sans supprimer les enregistrements MX existants de SpaceMail pour la réception de `hello@shiftflow.io`. Si la configuration du domaine racine entre en conflit avec un enregistrement existant, utiliser un sous-domaine d'envoi et adapter `ONBOARDING_EMAIL_FROM` en conséquence.
2. Vérifier dans Resend que le domaine est marqué *Verified*. Créer une clé API avec le droit d'envoyer des emails. Ne jamais mettre cette clé dans Git.
3. Ajouter au **service backend FastAPI** de production les variables suivantes :

   ```text
   RESEND_API_KEY=re_...                 # clé secrète créée chez Resend
   ONBOARDING_EMAIL_FROM=ShiftFlow <hello@shiftflow.io>
   ONBOARDING_EMAILS_ENABLED=true
   FRONTEND_URL=https://www.shiftflow.io
   ```

   `JWT_SECRET` et `WEBHOOK_CRON_SECRET` doivent déjà être configurés pour l'application et le planificateur. La clé Resend se configure sur le service **API Python**, pas sur le service WhatsApp Node ni sur le frontend.

4. Après déploiement, vérifier le champ `emails_sent` de la réponse cron/logs et l'onglet *Emails* de Resend. Tester d'abord la livraison avec sa propre adresse via la console Resend, puis activer la variable `ONBOARDING_EMAILS_ENABLED`. Pour mettre immédiatement les relances en pause, la passer à `false`.

## Règles

- Comptes créés depuis au plus 14 jours seulement, hors plan Pro et hors personnes désinscrites.
- Après 3 h sans mission : lien vers la création de mission.
- Après 2 h avec mission active mais aucun intervenant actif : lien direct vers les intervenants.
- Après 4 h avec intervenants mais aucune invitation WhatsApp envoyée : lien vers la mission. Le message invite à connecter WhatsApp si nécessaire, sans supposer que la session est encore active.
- Après la première invitation WhatsApp envoyée, arrêt des relances. Un seul email par étape et au plus un email de démarrage par 24 h et par compte ; limite additionnelle à 5 par passage et 90 par jour pour préserver le quota gratuit.
- Un lien de désinscription signé accompagne chaque email ; l'adresse `hello@shiftflow.io` reçoit les réponses. Les essais d'envoi sont enregistrés dans la collection `onboarding_emails` avec l'identifiant de Resend et une clé d'idempotence.

Ces relances sont des conseils de prise en main. Ne pas utiliser ce système pour des campagnes promotionnelles ou envoyer des emails aux intervenants.
