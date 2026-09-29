import React, { useEffect, useState } from "react";
import { Sparkles, X, ArrowDown } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useActivation } from "../context/ActivationContext";

export default function ContextGuide({ id, step, title, children, always = false, target }) {
  const { user } = useAuth();
  const activation = useActivation();
  const key = `shiftflow_guide_${user?.id}_${id}`;
  const [dismissed, setDismissed] = useState(() => { try { return localStorage.getItem(key) === "done"; } catch { return false; } });
  useEffect(() => {
    const replay = () => setDismissed(false);
    window.addEventListener("shiftflow:replay-guide", replay);
    return () => window.removeEventListener("shiftflow:replay-guide", replay);
  }, []);
  const visible = !dismissed && (always || !!activation?.next);
  useEffect(() => {
    if (!visible || !target) return;
    const element = document.querySelector(target);
    element?.classList.add("guided-action-target");
    return () => element?.classList.remove("guided-action-target");
  }, [visible, target]);
  if (!visible) return null;
  return <aside className="context-guide" aria-label={title} data-testid={`guide-${id}`}>
    <div className="flex items-start gap-3">
      <span className="guide-beacon" aria-hidden="true"><Sparkles size={18} /></span>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-blue-700">{step ? `Étape ${step} sur 4` : "Votre profil"} · À vous de jouer</p>
        <h2 className="mt-1 font-semibold text-gray-950">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-gray-600">{children}</p>
      </div>
      <button type="button" className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-white" aria-label="Masquer ce conseil" onClick={() => { setDismissed(true); try { localStorage.setItem(key, "done"); } catch {} }}><X size={17} /></button>
    </div>
    <div className="mt-3 flex items-center gap-2 text-xs font-medium text-blue-700"><ArrowDown size={14} aria-hidden="true" />Commencez juste en dessous</div>
  </aside>;
}
