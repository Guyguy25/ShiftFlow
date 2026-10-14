import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";
import { getPageSeo, getStructuredData, SITE_NAME, SITE_URL } from "../lib/seo";

export default function Seo() {
  const { pathname } = useLocation();
  useLayoutEffect(() => {
    const page = getPageSeo(pathname);
    document.title = page.title;
    const meta = (attribute, key, content) => {
      let element = document.head.querySelector(`meta[${attribute}="${key}"]`);
      if (!element) {
        element = document.createElement("meta");
        element.setAttribute(attribute, key);
        document.head.appendChild(element);
      }
      element.content = content;
    };
    meta("name", "description", page.description);
    meta("name", "robots", page.robots);
    meta("property", "og:title", page.title);
    meta("property", "og:description", page.description);
    meta("property", "og:site_name", SITE_NAME);
    meta("property", "og:type", "website");
    meta("property", "og:locale", "fr_FR");
    meta("name", "twitter:card", "summary");
    meta("name", "twitter:title", page.title);
    meta("name", "twitter:description", page.description);
    let canonical = document.head.querySelector('link[rel="canonical"]');
    if (page.canonical) {
      if (!canonical) {
        canonical = document.createElement("link");
        canonical.rel = "canonical";
        document.head.appendChild(canonical);
      }
      canonical.href = page.canonical;
      meta("property", "og:url", page.canonical);
    } else {
      canonical?.remove();
      document.head.querySelector('meta[property="og:url"]')?.remove();
    }
    meta("property", "og:image", `${SITE_URL}/shiftflow-logo.svg`);
    document.getElementById("seo-structured-data")?.remove();
    const data = getStructuredData(pathname);
    if (data) {
      const script = document.createElement("script");
      script.id = "seo-structured-data";
      script.type = "application/ld+json";
      script.textContent = JSON.stringify(data);
      document.head.appendChild(script);
    }
  }, [pathname]);
  return null;
}
