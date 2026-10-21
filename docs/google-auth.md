# Activer Google sur ShiftFlow

Le code utilise Google Identity Services (fenêtre Google puis vérification du jeton côté serveur).

## Écran de consentement Google Cloud

- Page d'accueil : https://shiftflow.io
- Politique de confidentialité : https://shiftflow.io/confidentialite
- Conditions d'utilisation : https://shiftflow.io/conditions
- Domaine autorisé : `shiftflow.io` (sans https ni chemin)
- Contact : contact@shiftflow.io

Les deux pages doivent être publiées et accessibles sans connexion. Vérifier la propriété du domaine dans Google Search Console si Google le demande. L'identité légale contient encore une adresse et un SIREN à compléter dans `frontend/src/constants/legal.js`.

## Client OAuth

Créer un client de type **Application Web**. Ajouter les origines JavaScript autorisées :

- https://shiftflow.io
- https://www.shiftflow.io (si utilisé)
- http://localhost:3000 (uniquement pour le développement)

Ce flux ne nécessite pas d'URI de redirection ni de client secret. Il utilise uniquement les autorisations `openid`, `email`, `profile` pour l'identité ; aucun accès à Gmail, Drive ou Agenda.

L'identifiant client public de production est configuré par défaut dans le backend : `864934647730-ao3eo3ebu3fe894a8qitikh2aher5mgs.apps.googleusercontent.com`. La variable serveur `GOOGLE_CLIENT_ID` permet de le remplacer (ou de désactiver Google avec une valeur vide). Aucun secret client n'est nécessaire ni stocké. Après un changement de configuration, redéployer le backend.

Si l'application Google est en mode Test, ajouter les comptes de test autorisés. Passer en production pour une utilisation publique et suivre les éventuelles demandes de validation Google.

## Vérification après déploiement

1. Ouvrir `/register` : choisir Google dès l'étape 1 (ou saisir email et mot de passe), régler les deux curseurs à l'étape 2, puis lire l'estimation à l'étape 3. Le compte est créé uniquement au clic sur « Commencer », qui vaut acceptation des conditions affichées. L'email provient du compte Google sélectionné ; aucun mot de passe ShiftFlow n'est demandé dans ce cas. Le nom, l'organisation et le téléphone ne sont plus requis à l'inscription.
2. Vérifier le tableau de bord, les trois missions offertes et la déconnexion.
3. Revenir sur `/login` et utiliser le même compte Google.
4. Vérifier le refus/annulation de Google et la connexion classique par mot de passe.
5. Les comptes existants sont retrouvés automatiquement seulement si Google fait autorité sur l'adresse (Gmail ou domaine Workspace vérifié). Sinon, conserver la connexion par mot de passe ; aucun rattachement automatique par simple correspondance d'email.

Les challenges expirent après 10 minutes et sont utilisables une seule fois. Les jetons Google sont vérifiés (signature, audience, émetteur, expiration, nonce, email vérifié). Le compte conserve seulement l'identifiant Google et son email ; aucun jeton Google n'est stocké.
