# Référencement de ShiftFlow.io

Les pages publiques `/`, `/pricing` et `/demo` sont rendues en HTML lors de la
compilation, à partir des mêmes composants React que le site interactif. Elles
contiennent leur titre, description, URL canonique et données structurées avant
l'exécution de JavaScript. `src/lib/seo.js` centralise ces informations et la liste
des pages du sitemap. Le domaine canonique est `https://www.shiftflow.io`, comme
le domaine de production existant.

Le script de compilation écrit `build/seo/*.html` et `build/sitemap.xml`.
Les réécritures de `frontend/vercel.json` servent les trois pages publiques ; le
routage API défini à la racine reste inchangé. Le HTML de repli des autres routes
porte `noindex` et ne contient pas de contenu marketing ni d'URL canonique.
La navigation React met également les métadonnées à jour et retire les données
structurées publiques des écrans privés. `noindex` ne remplace pas les contrôles
d'accès existants. Les routes privées restent explorables afin que les moteurs
puissent lire cette directive ; seule l'API est exclue du robots.txt.

## Contrôles après déploiement

- Vérifier que `/robots.txt` renvoie du texte et `/sitemap.xml` du XML.
- Vérifier dans le code source de `/`, `/pricing` et `/demo` la présence du
  contenu, du bon titre, d'une seule URL canonique et de `index, follow`.
- Vérifier qu'une route `/app/...` renvoie le HTML de repli `noindex`.
- Tester la connexion, la simulation et les liens de paiement habituels.

## Actions dans Google Search Console

Ces actions nécessitent un accès propriétaire à la propriété du domaine :

1. Vérifier la propriété de domaine `shiftflow.io` par DNS si nécessaire.
2. Soumettre `https://www.shiftflow.io/sitemap.xml` dans « Sitemaps ».
3. Inspecter l'accueil, les tarifs et la démo ; tester les URL publiées puis
   demander leur indexation.
4. Suivre les impressions, clics et pages indexées pour les requêtes `shiftflow`,
   `shiftflow.io`, `gestion équipes événementielles` et les recherches pertinentes.

Le nom et l'extrait affichés restent choisis par Google. La réexploration peut
prendre plusieurs jours à plusieurs semaines. Aucune première position n'est
garantie. Des liens depuis de vrais partenaires événementiels et des profils
d'entreprise cohérents avec le nom et le domaine renforcent l'identité de marque.
Ne pas acheter de liens ni créer de faux avis ou de pages répétitives pour les
fautes de frappe ; `shitflow` n'est pas un nom alternatif de la marque.

Références :
- https://developers.google.com/search/docs/appearance/site-names
- https://developers.google.com/search/docs/crawling-indexing/javascript/javascript-seo-basics
- https://vercel.com/kb/guide/vercel-services
