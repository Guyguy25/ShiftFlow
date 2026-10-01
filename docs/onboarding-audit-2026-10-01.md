# Audit du guidage — 1 octobre 2026

## Décision

Conserver une page aérée, une action principale et le rappel « Premiers pas » en bas à droite. Ne pas remplacer tous les espaces libres par une deuxième liste de tâches. Ajouter une aide attachée à l’action réelle et une visite facultative des sections. Le guide suit les données et les actions, plutôt qu’un bouton « suivant » qui validerait artificiellement une étape.

## Parcours examiné

| Moment | Observation | Choix retenu |
|---|---|---|
| Inscription | Trois étapes courtes existent déjà, avec sauvegarde du brouillon. | Conserver ce formulaire et ses validations, sans superposer une visite. |
| Bienvenue | Le message existe, mais ne doit pas concurrencer une deuxième bulle. | Suspendre le guide pendant la fenêtre de bienvenue, puis montrer l’action utile. |
| Premier accueil | La checklist décrit les étapes sans pointer précisément où agir. | Encadrer le bouton de création ; mettre le détail des quatre étapes dans une section dépliable. |
| Nom et lieu | Le débutant ne sait pas toujours quoi saisir. | Exemple de prestation et bulle sur le premier champ manquant, puis sur Continuer. |
| Créneau | Date, horaires, effectif et tarif sont nécessaires ; les options alourdissent la lecture. | Guider les champs utiles ; replier compétence et consignes facultatives. |
| Création | Confusion possible entre enregistrer et envoyer. | Expliquer que la sélection des contacts et la confirmation viennent ensuite. |
| Ajout de l’équipe | Le choix WhatsApp / saisie existe mais manque de repère visuel. | Pointer l’ajout, le QR/code, les contacts à cocher, puis l’import. Guider aussi la saisie manuelle. |
| Connexion WhatsApp | Les instructions existent ; le QR ne doit pas être recouvert. | Bulle placée à côté du QR ou hors de sa surface ; guide limité au contenu de la fenêtre ouverte. |
| Sélection | L’ordre et la différence entre aperçu et envoi demandent une explication. | Pointer la sélection puis la vérification, rappeler la priorité modifiable. |
| Confirmation | Une bulle flottante pourrait masquer le message à relire. | Intégrer cette dernière aide dans la page, sous le bouton. Aucun clic ni envoi automatique. |
| Repères dans l’app | Certains utilisateurs veulent comprendre les sections avant de commencer. | Visite facultative de quatre repères : accueil, missions, intervenants, compte. |
| Retour / abandon | L’utilisateur doit pouvoir reprendre sans subir le guide à chaque ouverture. | Fermeture mémorisée par compte dans ce navigateur, reprise depuis « Premiers pas ». |
| Utilisateur activé | Les bulles automatiques deviennent inutiles. | Arrêt automatique après activation complète ; aide toujours réouvrable. |

## Comparaison avec les pratiques documentées

- [Intercom — First-use onboarding](https://www.intercom.com/blog/product-tours-first-use-onboarding/) : orienter la découverte vers une première action utile avec une explication contextualisée.
- [Appcues — Onboarding UI/UX patterns](https://www.appcues.com/blog/user-onboarding-ui-ux-patterns) : exemples de checklists, tooltips et divulgation progressive, notamment chez Typeform et Airtable. Nous retenons les indications courtes liées à la tâche et une visite limitée, pas une démonstration exhaustive des fonctionnalités.

Ce sont des principes de conception et des exemples publics, pas une preuve que ce changement augmentera la conversion de ShiftFlow. Comparer ensuite, sur des cohortes suffisantes, inscription → mission créée → équipe ajoutée → connexion → première demande confirmée. Aucun nouveau suivi marketing n’est ajouté ici.

## Vérifications

- Compilation de production réussie ; 50 tests frontend passent.
- Parcours navigateur avec API simulée : accueil, formulaire, fermeture persistante, reprise, visite des quatre sections, formats 1440 px, 390 px et 320 px.
- Parcours complet simulé : équipe vide → affichage du QR → connexion → sélection des contacts → import → sélection pour la mission → aperçu → confirmation explicite.
- Aucune requête d’envoi avant confirmation ; une seule requête après le clic. Aucun compte client, contact réel ou message de production utilisé.
- Contrôle des captures : bouton cible accessible, QR visible, dernière aide intégrée sans couvrir l’aperçu ; absence de débordement horizontal sur les formats testés.
- La liaison WhatsApp et la livraison de vrais messages ne sont pas validées par ces tests d’interface.
