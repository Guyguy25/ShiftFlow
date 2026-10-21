/* Render the actual public React pages at build time. No browser, API calls,
 * credentials, or second copy of the marketing content is needed. The existing
 * client app still mounts normally and owns all interactive/authenticated flows.
 */
const fs = require("node:fs");
const path = require("node:path");
const babel = require("@babel/core");
const sourceDir = path.resolve(__dirname, "../src");
const originalLoader = require.extensions[".js"];
require.extensions[".js"] = (module, filename) => {
  if (!filename.startsWith(`${sourceDir}${path.sep}`)) return originalLoader(module, filename);
  const { code } = babel.transformFileSync(filename, {
    babelrc: false, configFile: false,
    presets: [[require.resolve("@babel/preset-env"), { targets: { node: "current" } }], require.resolve("@babel/preset-react")],
  });
  module._compile(code, filename);
};

const React = require("react");
const { renderToString } = require("react-dom/server");
const { MemoryRouter } = require("react-router-dom");
const { AuthProvider } = require("../src/context/AuthContext");
const { PUBLIC_PAGES, SITE_NAME, SITE_URL, getPageSeo, getStructuredData } = require("../src/lib/seo");
const pages = {
  "/test-accompagne": require("../src/pages/AccompaniedTrial").default,
  "/": require("../src/pages/Landing").default,
  "/pricing": require("../src/pages/Pricing").default,
  "/demo": require("../src/pages/Demo").default,
};
const buildDir = path.resolve(__dirname, "../build");
const template = fs.readFileSync(path.join(buildDir, "index.html"), "utf8");
fs.writeFileSync(path.join(buildDir, "app-shell.html"), template);
const escape = value => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
fs.mkdirSync(path.join(buildDir, "seo"), { recursive: true });

for (const [route, Component] of Object.entries(pages)) {
  const page = getPageSeo(route);
  const content = renderToString(React.createElement(MemoryRouter, { initialEntries: [route] },
    React.createElement(AuthProvider, null, React.createElement(Component))));
  const meta = (attribute, key, value) => `<meta ${attribute}="${key}" content="${escape(value)}"/>`;
  const head = [
    `<link rel="canonical" href="${page.canonical}"/>`,
    meta("property", "og:type", "website"), meta("property", "og:locale", "fr_FR"),
    meta("property", "og:site_name", SITE_NAME), meta("property", "og:title", page.title),
    meta("property", "og:description", page.description), meta("property", "og:url", page.canonical),
    meta("property", "og:image", `${SITE_URL}/shiftflow-logo.svg`),
    meta("name", "twitter:card", "summary"), meta("name", "twitter:title", page.title),
    meta("name", "twitter:description", page.description),
    `<script id="seo-structured-data" type="application/ld+json">${JSON.stringify(getStructuredData(route)).replace(/</g, "\\u003c")}</script>`,
  ].join("");
  const html = template
    .replace(/<title>[^<]*<\/title>/, `<title>${escape(page.title)}</title>`)
    .replace(/<meta name="description"[^>]*>/, meta("name", "description", page.description))
    .replace(/<meta name="robots"[^>]*>/, meta("name", "robots", page.robots))
    .replace("</head>", `${head}</head>`)
    .replace('<div id="root"></div>', `<div id="root">${content}</div>`);
  if (!html.includes(content) || !html.includes(page.canonical)) throw new Error(`Failed to prerender ${route}`);
  const filename = route === "/" ? "home" : route.slice(1);
  fs.writeFileSync(path.join(buildDir, "seo", `${filename}.html`), html);
  // Also expose directory indexes for hosts that use filesystem routing before
  // framework rewrites. The homepage must never fall back to a noindex shell.
  const directory = route === "/" ? buildDir : path.join(buildDir, route.slice(1));
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), html);
  console.log(`Prerendered ${route} (${content.length} characters)`);
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${Object.keys(PUBLIC_PAGES).map(route => `  <url><loc>${getPageSeo(route).canonical}</loc></url>`).join("\n")}\n</urlset>\n`;
fs.writeFileSync(path.join(buildDir, "sitemap.xml"), sitemap);

// The same noindex application shell for fixed non-marketing entry points.
// This also protects direct requests when a host prefers filesystem routing.
for (const route of ["login", "register", "invite", "onboarding", "admin", "hours", "app/hours", "payment/success", "payment/cancel",
  "mentions-legales", "conditions", "confidentialite", "cookies", "dpa", "app", "app/dashboard",
  "app/missions", "app/missions/new", "app/workers", "app/calendar", "app/history", "app/help",
  "app/tutorial", "app/profile", "app/settings"]) {
  const directory = path.join(buildDir, route);
  fs.mkdirSync(directory, { recursive: true });
  fs.writeFileSync(path.join(directory, "index.html"), template);
}
