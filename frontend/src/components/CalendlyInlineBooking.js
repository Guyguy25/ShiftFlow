import React, { useEffect, useRef, useState } from "react";

const BOOKING_URL = "https://calendly.com/tanguybois/appel";
const CALENDLY_SCRIPT = "https://assets.calendly.com/assets/external/widget.js";

let scriptPromise = null;

function loadCalendly() {
  if (window.Calendly?.initInlineWidget) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  // Only load Calendly once the visitor has completed the qualification form.
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = CALENDLY_SCRIPT;
    script.async = true;
    script.dataset.shiftflowCalendly = "true";
    script.onload = () => {
      if (window.Calendly?.initInlineWidget) resolve();
      else {
        scriptPromise = null;
        reject(new Error("Calendly widget unavailable"));
      }
    };
    script.onerror = () => {
      script.remove();
      scriptPromise = null;
      reject(new Error("Calendly script failed to load"));
    };
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export default function CalendlyInlineBooking({ name, email }) {
  const container = useRef(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let active = true;
    setFailed(false);

    loadCalendly().then(() => {
      if (!active || !container.current) return;
      // React StrictMode and retries must not stack duplicate iframes.
      container.current.replaceChildren();
      window.Calendly.initInlineWidget({
        url: BOOKING_URL,
        parentElement: container.current,
        prefill: { name, email },
        resize: true,
      });
    }).catch(() => {
      if (active) setFailed(true);
    });

    return () => {
      active = false;
      container.current?.replaceChildren();
    };
  }, [name, email]);

  return <div className="mt-6">
    {failed ? <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-slate-700">
      L’agenda ne peut pas s’afficher ici. Vous pouvez tout de même réserver via le lien ci-dessous.
    </p> : null}
    <div
      ref={container}
      className="w-full min-w-0"
      style={{ minHeight: failed ? 0 : 720 }}
      aria-label="Agenda de réservation Calendly"
      data-testid="calendly-inline-booking"
    />
    <p className="mt-3 text-center text-xs text-slate-500">
      Un souci d’affichage ? <a className="font-semibold text-blue-700 underline hover:text-blue-800" href={BOOKING_URL} target="_blank" rel="noopener noreferrer">Ouvrir Calendly directement</a>
    </p>
  </div>;
}

export { BOOKING_URL };
