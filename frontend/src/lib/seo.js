export const SITE_URL = "https://www.shiftflow.io";
export const SITE_NAME = "ShiftFlow.io";

// Only these public marketing pages belong in the sitemap and search results.
export const PUBLIC_PAGES = {
  "/": {
    title: "ShiftFlow.io | Gestion des équipes événementielles",
    description: "ShiftFlow.io, le logiciel pour organiser vos équipes événementielles : missions, disponibilités, confirmations et relances WhatsApp. 3 missions offertes.",
    label: "Accueil",
  },
  "/pricing": {
    title: "Tarifs ShiftFlow.io | Logiciel pour l’événementiel",
    description: "Découvrez les tarifs de ShiftFlow.io pour gérer vos équipes événementielles : 3 missions offertes, paiement à la mission ou abonnement Pro sans engagement.",
    label: "Tarifs",
  },
  "/demo": {
    title: "Démo ShiftFlow.io | Organisation des équipes événementielles",
    description: "Essayez ShiftFlow.io sans compte : simulez une mission événementielle et découvrez les demandes WhatsApp en cascade, sans contacter de vrais intervenants.",
    label: "Démonstration",
  },
};

export function getPageSeo(pathname) {
  const path = pathname.replace(/\/+$/, "") || "/";
  const page = PUBLIC_PAGES[path];
  return {
    ...(page || { title: "ShiftFlow.io | Espace sécurisé", description: "Connectez-vous à ShiftFlow.io pour gérer vos missions et vos équipes événementielles." }),
    path,
    canonical: page ? `${SITE_URL}${path === "/" ? "/" : path}` : null,
    robots: page ? "index, follow, max-image-preview:large" : "noindex, follow",
  };
}

export function getStructuredData(pathname) {
  const page = getPageSeo(pathname);
  if (!page.canonical) return null;
  const graph = [
    {
      "@type": "WebPage", "@id": `${page.canonical}#webpage`, url: page.canonical,
      name: page.title, description: page.description, inLanguage: "fr-FR",
      isPartOf: { "@id": `${SITE_URL}/#website` },
    },
  ];
  if (page.path === "/") {
    graph.push(
      {
        "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: `${SITE_URL}/`,
        name: SITE_NAME, alternateName: ["ShiftFlow", "shiftflow.io"], inLanguage: "fr-FR",
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
      {
        "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME,
        url: `${SITE_URL}/`, logo: `${SITE_URL}/shiftflow-logo.svg`, email: "contact@shiftflow.io",
        description: "Logiciel de gestion des missions et des équipes pour les agences et prestataires événementiels.",
      },
      {
        "@type": "SoftwareApplication", "@id": `${SITE_URL}/#software`, name: SITE_NAME,
        url: `${SITE_URL}/`, applicationCategory: "BusinessApplication", operatingSystem: "Web",
        description: PUBLIC_PAGES["/"].description,
        featureList: ["Gestion des missions événementielles", "Organisation des intervenants", "Demandes et rappels WhatsApp", "Suivi des confirmations", "Cascade automatique"],
        publisher: { "@id": `${SITE_URL}/#organization` },
      },
    );
  } else {
    graph.push({
      "@type": "BreadcrumbList",
      itemListElement: [
        { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${SITE_URL}/` },
        { "@type": "ListItem", position: 2, name: page.label, item: page.canonical },
      ],
    });
  }
  return { "@context": "https://schema.org", "@graph": graph };
}
