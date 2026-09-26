import React, { useEffect, useRef, useState } from "react";
import { Link, useLocation } from "react-router-dom";

const META_PIXEL_ID = "1749796536239379";
const CONSENT_KEY = "shiftflow_cookie_consent";
const ATTRIBUTION_KEY = "shiftflow_meta_attribution";
const ATTRIBUTION_PARAMS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_content",
  "utm_term",
  "placement",
  "campaign_id",
  "adset_id",
  "ad_id",
  "fbclid",
];

function loadMetaPixel() {
  if (window.fbq) return;

  /* Meta Pixel base code, loaded only after advertising consent */
  // eslint-disable-next-line no-unused-expressions
  !function(f,b,e,v,n,t,s)
  {if(f.fbq)return;n=f.fbq=function(){n.callMethod?
  n.callMethod.apply(n,arguments):n.queue.push(arguments)};
  if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
  n.queue=[];t=b.createElement(e);t.async=!0;
  t.src=v;s=b.getElementsByTagName(e)[0];
  s.parentNode.insertBefore(t,s)}(window, document,'script',
  'https://connect.facebook.net/en_US/fbevents.js');

  window.fbq('init', META_PIXEL_ID);
}

function attributionFromLocation(search, pathname) {
  const params = new URLSearchParams(search || "");
  const attribution = {};

  ATTRIBUTION_PARAMS.forEach((key) => {
    const value = params.get(key);
    if (value) attribution[key] = value;
  });

  if (!Object.keys(attribution).length) return null;

  return {
    ...attribution,
    landing_path: pathname || "/",
    captured_at: new Date().toISOString(),
  };
}

function persistAttribution(attribution) {
  if (!attribution) return;
  try {
    const previous = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || "{}");
    localStorage.setItem(
      ATTRIBUTION_KEY,
      JSON.stringify(previous.captured_at ? previous : attribution)
    );
  } catch {
    // Attribution is best-effort and must never affect navigation or signup.
  }
}

export default function MetaPixel() {
  const location = useLocation();
  const [consent, setConsent] = useState(() => localStorage.getItem(CONSENT_KEY));
  const pendingAttribution = useRef(null);

  useEffect(() => {
    const candidate = attributionFromLocation(location.search, location.pathname);
    if (candidate && !pendingAttribution.current) pendingAttribution.current = candidate;

    if (consent === "accepted") {
      persistAttribution(pendingAttribution.current);
      pendingAttribution.current = null;

      loadMetaPixel();
      window.fbq?.("track", "PageView");
    }
  }, [consent, location.pathname, location.search]);

  const choose = (value) => {
    localStorage.setItem(CONSENT_KEY, value);
    setConsent(value);
  };

  if (consent) return null;

  return (
    <div className="fixed inset-x-0 bottom-0 z-[100] p-4 sm:p-5" role="dialog" aria-label="Choix des cookies">
      <div className="max-w-4xl mx-auto rounded-2xl border border-gray-200 bg-white shadow-[0_18px_60px_rgba(15,23,42,0.22)] p-4 sm:p-5">
        <div className="sm:flex sm:items-center sm:justify-between sm:gap-6">
          <div className="text-left">
            <div className="font-semibold text-gray-950">Cookies publicitaires</div>
            <p className="mt-1 text-sm leading-relaxed text-gray-600">
              ShiftFlow utilise le Pixel Meta pour mesurer les performances de ses campagnes publicitaires. Il n'est activé que si vous l'acceptez.
              {" "}<Link to="/cookies" className="text-blue-600 hover:underline">En savoir plus</Link>
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex flex-col-reverse sm:flex-row gap-2 shrink-0">
            <button
              type="button"
              onClick={() => choose("refused")}
              className="px-4 py-2.5 rounded-lg border border-gray-300 bg-white text-sm font-semibold text-gray-700 hover:bg-gray-50"
            >
              Refuser
            </button>
            <button
              type="button"
              onClick={() => choose("accepted")}
              className="px-4 py-2.5 rounded-lg bg-blue-600 text-sm font-semibold text-white hover:bg-blue-700"
            >
              Accepter
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
