# Interface et premiers pas — 1 octobre 2026

- Navigation métier conservée ; solde, profil, offres, paramètres, aide et déconnexion regroupés dans le menu de compte.
- Profil séparé avec photo recadrée et compressée côté navigateur, enregistrée sur le compte authentifié. Les anciens clients qui n’envoient pas de photo conservent la photo existante.
- État vide sur l’accueil, avec une action principale et une illustration du parcours.
- Rappel « Premiers pas » présent sur toutes les pages privées, replié par défaut, avec progression issue des données existantes et explications accessibles au clic. Position mobile au-dessus de la navigation.
- Bienvenue après inscription uniquement, mémorisée par compte dans ce navigateur ; fermer ou commencer consomme ce message.
- Paramètres avancés repliables. Textes « valables à vie » et accords des compteurs corrigés sans modifier la facturation.

Validation : compilation de production ; 45 tests frontend ; 3 tests backend (photo et mise à jour limitée au compte) ; parcours navigateur simulant les API : accueil à 0/4 puis 1/4, guide interactif, menu compte, modification du nom et photo, réglages repliés, bienvenue affichée une fois, absence de débordement horizontal à 390 px. Contrôle visuel à 1440 px et 390 px. Aucune donnée client ni envoi WhatsApp utilisé pour ces essais.
