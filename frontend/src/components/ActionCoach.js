import React, { useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Sparkles, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";

// The bubble stays next to its actual action, without a blocking overlay or viewport coordinates.
export default function ActionCoach({ id, href, label, description, step }) {
  const { user } = useAuth();
  const descriptionId = useId();
  const actionRef = useRef(null);
  const key = `shiftflow_guide_${user?.id}_action-${id}`;
  const [hidden, setHidden] = useState(() => { try { return localStorage.getItem(key) === "done"; } catch { return false; } });
  useEffect(() => {
    const replay = () => setHidden(false);
    window.addEventListener("shiftflow:replay-guide", replay);
    return () => window.removeEventListener("shiftflow:replay-guide", replay);
  }, []);
  const dismiss = () => { setHidden(true); actionRef.current?.focus({ preventScroll: true }); try { localStorage.setItem(key, "done"); } catch {} };
  return <div className={`action-coach ${hidden ? "is-dismissed" : ""}`} onKeyDown={event => { if (event.key === "Escape") dismiss(); }} data-testid="action-coach">
    <Link ref={actionRef} to={href} className={`action-coach-target ${hidden ? "" : "is-highlighted"}`} aria-describedby={hidden ? undefined : descriptionId}>
      {label}<ArrowRight size={18} aria-hidden="true" />
    </Link>
    {!hidden && <aside className="action-coach-bubble" aria-label="Conseil pour la prochaine action">
      <div className="flex items-start gap-2">
        <Sparkles size={17} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true" />
        <div className="min-w-0 flex-1"><p className="text-xs font-bold text-blue-700">{step ? `Étape ${step} sur 4` : "Prochaine action"}</p><p className="mt-1 text-sm font-semibold text-gray-950">{step === 1 ? "Commencez ici" : "À vous de jouer"}</p></div>
        <button type="button" onClick={dismiss} className="coach-dismiss" aria-label="Masquer la bulle d’aide"><X size={16} aria-hidden="true" /></button>
      </div>
      <p id={descriptionId} className="mt-2 text-sm leading-relaxed text-gray-600">{description}</p>
    </aside>}
  </div>;
}
