import React, { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ArrowRight, MousePointer2, X } from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useActivation } from "../context/ActivationContext";
import { actionHints, sectionHints, coachPosition } from "../lib/onboardingCoach";

const visible = el => el && el.getClientRects().length > 0 && getComputedStyle(el).visibility !== "hidden";
export default function OnboardingCoach() {
  const { user } = useAuth();
  const activation = useActivation();
  const key = `shiftflow-action-guide-${user.id}`;
  const [paused, setPaused] = useState(() => { try { return localStorage.getItem(key) === "paused"; } catch { return false; } });
  const [mode, setMode] = useState("action");
  const [index, setIndex] = useState(0);
  const [forced, setForced] = useState(false);
  const [view, setView] = useState(null);
  const card = useRef(null);
  const target = useRef(null);
  const inlineHost = useRef(null);
  const enabled = !paused && (mode === "sections" || forced || !!activation?.next);
  useEffect(() => {
    const replay = event => { setPaused(false); setForced(true); setMode(event.detail?.mode || "action"); setIndex(0); try { localStorage.removeItem(key); } catch {} };
    window.addEventListener("shiftflow:replay-guide", replay);
    return () => window.removeEventListener("shiftflow:replay-guide", replay);
  }, [key]);
  const dismiss = () => { setPaused(true); setForced(false); try { localStorage.setItem(key, "paused"); } catch {} };
  useEffect(() => {
    if (!enabled) { setView(null); return; }
    let frame = 0;
    let measuredCard = null;
    const update = () => {
      frame = 0;
      // A guide never competes with a welcome, account menu or checklist popover.
      const blocking = [...document.querySelectorAll('[role="dialog"], [role="menu"]')].some(visible);
      const modal = [...document.querySelectorAll('[data-onboarding-modal]')].filter(visible).pop();
      let element, hint, id;
      if (!blocking) {
        if (mode === "sections" && !modal) {
          const section = sectionHints[index];
          element = section.selectors.flatMap(selector => [...document.querySelectorAll(selector)]).find(visible);
          hint = [section.title, section.text]; id = `section-${index}`;
        } else if (mode === "action") {
          element = [...(modal || document).querySelectorAll('[data-onboarding]')].find(el => visible(el) && actionHints[el.dataset.onboarding] && !el.disabled);
          id = element?.dataset.onboarding; hint = actionHints[id];
        }
      }
      if (target.current !== element) { target.current?.classList.remove("onboarding-target"); target.current?.removeAttribute("aria-details"); target.current = element; element?.classList.add("onboarding-target"); element?.setAttribute("aria-details", "onboarding-coach-description"); }
      if (!element || !hint) { setView(previous => previous === null ? previous : null); return; }
      if (measuredCard !== card.current) {
        if (measuredCard) resize.unobserve(measuredCard);
        measuredCard = card.current;
        if (measuredCard) resize.observe(measuredCard);
      }
      const rect = element.getBoundingClientRect();
      inlineHost.current = element.nextElementSibling?.matches(`[data-onboarding-inline="${id}"]`) ? element.nextElementSibling : null;
      const sideRoom = Math.max(window.innerWidth - rect.right - 28, rect.left - 284);
      const width = window.innerWidth >= 1024 && sideRoom >= 252 ? Math.min(288, sideRoom) : Math.min(288, window.innerWidth - 24);
      const height = card.current?.offsetHeight || 230;
      const position = inlineHost.current ? { side: "none", inline: true } : coachPosition(rect, width, height, window.innerWidth, window.innerHeight);
      const arrow = position.side === "left" || position.side === "right" ? Math.max(20, Math.min(height - 20, rect.top + rect.height / 2 - position.top)) : Math.max(20, Math.min(width - 20, rect.left + rect.width / 2 - position.left));
      const next = { id, hint, width, ...position, arrow, modalZ: modal ? (parseInt(getComputedStyle(modal).zIndex, 10) || 50) + 5 : null };
      setView(previous => JSON.stringify(previous) === JSON.stringify(next) ? previous : next);
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    const observer = new MutationObserver(schedule);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["data-onboarding", "data-state", "open", "disabled"] });
    const resize = new ResizeObserver(schedule); resize.observe(document.body);
    window.addEventListener("resize", schedule); window.addEventListener("scroll", schedule, true);
    const escape = e => { if (e.key === "Escape" && !document.querySelector('[role="dialog"], [role="menu"]')) dismiss(); };
    window.addEventListener("keydown", escape);
    schedule();
    return () => { observer.disconnect(); resize.disconnect(); cancelAnimationFrame(frame); window.removeEventListener("resize", schedule); window.removeEventListener("scroll", schedule, true); window.removeEventListener("keydown", escape); target.current?.classList.remove("onboarding-target"); target.current?.removeAttribute("aria-details"); target.current = null; };
    // Dismiss uses this account's stable storage key; hint state must not restart observers.
  }, [enabled, mode, index, key]);
  if (!enabled || !view) return null;
  return createPortal(<aside ref={card} className="onboarding-coach" data-testid="onboarding-coach" data-guide-id={view.id} aria-label="Guide interactif" style={{ position: view.inline ? "relative" : "fixed", marginTop: view.inline ? 16 : undefined, left: view.left, top: view.top, width: view.inline ? "100%" : view.width, maxHeight: view.inline ? "none" : view.maxHeight, overflowY: view.maxHeight !== undefined ? "auto" : undefined, zIndex: view.modalZ || 45 }}>
    {view.side !== "none" && <span className={`onboarding-arrow arrow-${view.side}`} style={view.side === "left" || view.side === "right" ? { top: view.arrow } : { left: view.arrow }} />}
    <div className="flex items-start justify-between gap-2"><p className="flex items-center gap-2 text-xs font-bold text-blue-700"><MousePointer2 size={15} />{mode === "sections" ? `Vos repères · ${index + 1}/${sectionHints.length}` : "Votre prochaine action"}</p><button onClick={dismiss} aria-label="Masquer le guide interactif" className="-mt-2 -mr-2 rounded-lg p-2 text-gray-500 hover:bg-gray-100"><X size={17} /></button></div>
    <h2 className="mt-2 text-base font-bold leading-snug text-gray-950">{view.hint[0]}</h2>
    <p id="onboarding-coach-description" className="mt-2 text-sm leading-relaxed text-gray-600">{view.hint[1]}</p>
    {view.offscreen && <button onClick={() => target.current?.scrollIntoView({ block: "center", behavior: "instant" })} className="mt-3 min-h-10 text-sm font-semibold text-blue-700 underline">Voir l’élément à utiliser</button>}
    {mode === "sections" ? <div className="mt-4 flex items-center justify-between gap-3"><button onClick={() => { setMode("action"); setForced(true); }} className="min-h-10 text-xs text-gray-500">Passer la visite</button><button onClick={() => { if (index < sectionHints.length - 1) setIndex(index + 1); else { setMode("action"); setForced(true); } }} className="flex min-h-10 items-center gap-2 rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white">{index === sectionHints.length - 1 ? "Passer à l’action" : "Suivant"}<ArrowRight size={15} /></button></div> : <p className="mt-3 border-t border-blue-100 pt-3 text-xs font-medium text-blue-700">{view.offscreen ? "Retrouvez le cadre bleu pour continuer." : "Agissez directement dans le cadre bleu."}</p>}
  </aside>, view.inline && inlineHost.current ? inlineHost.current : document.body);
}
