# Offre finale : annuel, packs et lancement — 1er octobre 2026

Ce complément actualise l'étude de marché du 30 septembre. Les conclusions sont des hypothèses à mesurer, pas un optimum de conversion démontré.

## Prix retenus

| Choix | Montant à payer | Résultat |
|---|---:|---|
| Découverte | 0 € | 3 missions, une fois, sans expiration |
| 1 mission | 4,90 € | 1 crédit |
| 5 achetées + 1 offerte | 24,50 € | 6 crédits, environ 4,08 €/mission |
| 10 achetées + 2 offertes | 49 € | 12 crédits sans expiration |
| Quantité de 1 à 100 | quantité × 4,90 € | quantité + partie entière(quantité / 5) crédits |
| Pro mensuel | 49 € chaque mois | Missions illimitées pendant la période payée |
| Pro annuel | 499,80 € en une fois chaque année | Équivalent 41,65 €/mois ; missions illimitées |

Le bonus se calcule par commande, sans cumul des petites commandes précédentes. Les crédits achetés et offerts n'expirent pas. Un compte avec un solde peut acheter volontairement un pack ; le lien pour utiliser son solde reste visible. Un compte Pro ne peut pas acheter inutilement des crédits. Les transactions antérieures conservent l'offre achetée, sans bonus rétroactif.

## Pourquoi conserver 49 € sans énorme remise de lancement

La découverte gratuite apporte déjà une preuve d'usage. Le bonus récompense un achat groupé et l'annuel un engagement réel : 15 % d'économie, soit 588 − 499,80 = 88,20 € par an. Une promotion massive risquerait d'attirer surtout des acheteurs sensibles à la remise et de rendre le prix normal difficile à défendre. C'est une hypothèse à tester, pas une certitude concernant cette clientèle.

[NN/g sur la valeur perçue](https://www.nngroup.com/articles/perceived-value/) observe qu'une perception trop « discount » peut réduire l'engagement de certains utilisateurs. [NN/g sur les promotions](https://www.nngroup.com/articles/communicating-discounts/) soutient une présentation explicite de leurs avantages. Ces travaux ne démontrent pas le prix optimal de ShiftFlow.

Décision : pas de fausse date limite, pas de prix barré inventé, pas de tarif à vie. Le bénéfice présenté est concret : moins de relances et une équipe prête pour chaque mission. Une future promotion devra être évaluée sur activation, revenu net à 60 jours et rétention, pas seulement sur les achats immédiats.

## Économie et comparaison honnête

Aux frais indicatifs [Stripe France](https://stripe.com/fr/pricing/) de 1,5 % + 0,25 € pour une carte standard EEE, un pack de 24,50 € laisse environ 23,88 €, soit 3,98 € par crédit livré avant tous les autres coûts. Cinq transactions à 4,90 € auraient 1 € de frais fixes supplémentaire. L'absence de coût par message ne signifie pas une marge de 100 % : hébergement, paiement, support, acquisition, fiscalité, remboursements et temps de maintenance restent à mesurer.

Avec le bonus, un achat couvrant 11 ou 12 missions coûte 49 €. Pro mensuel devient strictement moins cher pour couvrir 13 missions dans le mois. Un pack peut toutefois être préférable pour une activité irrégulière étalée dans le temps. Les crédits inutilisés restent disponibles, tandis que Pro s'apprécie sur chaque période payée.

Le comparateur calcule le minimum de missions payantes pour couvrir le besoin avec bonus : plafond(5 × besoin / 6). L'annuel est affiché avec son total dû immédiatement et doit s'évaluer sur 12 mois. Son équivalent mensuel n'est jamais présenté comme un débit mensuel.

## Parcours

Mensuel choisi par défaut, bouton annuel explicite et total annuel visible. Pack de 5 + 1 présélectionné avec le montant 24,50 € répété dans le bouton ; possibilité de choisir une seule mission. Quantité, montant et bonus recalculés côté serveur. Une transaction Stripe peut être reçue plusieurs fois sans recréditer les missions.

Les emails de recommandation Pro exigent au moins 10 missions créées avec des crédits dans les 30 derniers jours et aucun crédit restant. Ils proposent le comparateur sans promettre que Pro est systématiquement moins cher. Les achats passés ne sont pas déduits de l'abonnement.

Les tests de paiement sont simulés, sans débit réel. Mesurer les volumes consommés, les crédits dormants, le taux de première mission, les conversions par offre et la rétention à 30/60 jours avant une nouvelle révision tarifaire.
