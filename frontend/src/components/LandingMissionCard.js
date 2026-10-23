import React, { useEffect, useRef, useState } from "react";
import { Pause, Play, SkipForward } from "lucide-react";

// Same illustrative sequence as the original Claude concept, adapted to React.
export const missionPhases = [
  {
    camille: "Proposition envoyée",
    alex: "En attente",
    sofiane: "En attente",
    recipient: "Camille",
    complete: false,
    explanation: "Camille reçoit la première proposition sur votre WhatsApp, avec un lien de réponse.",
  },
  {
    camille: "A refusé",
    alex: "Proposition envoyée",
    sofiane: "En attente",
    recipient: "Alex",
    complete: false,
    explanation: "Camille refuse. ShiftFlow envoie la proposition à Alex, suivant dans votre ordre de priorité.",
  },
  {
    camille: "A refusé",
    alex: "A confirmé ✓",
    sofiane: "En attente",
    recipient: "Alex",
    complete: true,
    explanation: "Alex accepte. La dernière place est pourvue sans nouveau message manuel.",
  },
];

const STATUS_COLORS = {
  "Proposition envoyée": "text-amber-400",
  "En attente": "text-[#a1a1aa]",
  "A refusé": "text-red-500",
  "A confirmé ✓": "text-[#25d366]",
};

function PersonRow({ name, initial, index, status }) {
  return (
    <li className="flex min-h-[52px] items-center justify-between gap-3 rounded-xl border border-[#2a2a2f] bg-[#141416] px-3 py-2.5 text-sm transition-colors duration-500">
      <span className="flex min-w-0 items-center gap-2.5 font-semibold text-[#f4f4f5]">
        <span aria-hidden="true" className="flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-full bg-[#2a2a2f] text-xs font-bold text-white">{initial}</span>
        <span className="whitespace-nowrap">{index}. {name}</span>
      </span>
      <span className={`text-right text-[11px] font-semibold leading-snug transition-colors duration-500 sm:text-xs ${STATUS_COLORS[status]}`}>{status}</span>
    </li>
  );
}

function prefersReducedMotion() {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
    : false;
}

export default function LandingMissionCard({ expanded = false }) {
  const cardRef = useRef(null);
  const [phase, setPhase] = useState(0);
  const [paused, setPaused] = useState(false);
  const [visible, setVisible] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(prefersReducedMotion);
  const current = missionPhases[phase];

  useEffect(() => {
    if (typeof window.IntersectionObserver !== "function" || !cardRef.current) return undefined;
    const observer = new window.IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { rootMargin: "100px" });
    observer.observe(cardRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return undefined;
    const query = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(query.matches);
    update();
    query.addEventListener?.("change", update);
    return () => query.removeEventListener?.("change", update);
  }, []);

  useEffect(() => {
    if (paused || reducedMotion || !visible) return undefined;
    const timer = window.setInterval(() => setPhase((previous) => (previous + 1) % missionPhases.length), 2600);
    return () => window.clearInterval(timer);
  }, [paused, reducedMotion, visible]);

  const progress = current.complete ? 100 : (14 / 15) * 100;

  return (
    <div
      ref={cardRef}
      data-testid="landing-mission-card"
      className="mx-auto w-full max-w-[520px] rounded-[20px] border border-[#2a2a2f] bg-[#1a1a1d] p-4 text-[#f4f4f5] shadow-[0_30px_80px_rgba(0,0,0,0.32)] sm:p-[22px]"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs text-[#a1a1aa] sm:text-[13px]">Vendredi · 7 h – 13 h · Lille Grand Palais</p>
          <h3 className="mt-1 text-base font-bold tracking-tight sm:text-lg">Montage stand · 15 roads</h3>
        </div>
        <span data-testid="landing-mission-count" className="shrink-0 rounded-full bg-[#163328] px-2.5 py-1 text-[11px] font-bold text-[#25d366] sm:text-xs">
          {current.complete ? "15/15 · équipe complète" : "14/15 confirmés"}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label="Confirmations de l’équipe fictive"
        aria-valuemin={0}
        aria-valuemax={15}
        aria-valuenow={current.complete ? 15 : 14}
        className="mt-4 h-2 overflow-hidden rounded-full bg-[#101012]"
      >
        <div className="h-full rounded-full bg-[#25d366] transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${progress}%` }} />
      </div>
      <p className="mt-2 text-[13px] text-[#a1a1aa]" data-testid="landing-mission-message">
        {current.complete ? "Équipe complète. La dernière place est pourvue." : "Plus qu’une place. ShiftFlow s’en occupe."}
      </p>

      <ol className="mt-4 space-y-2" aria-label="Ordre de priorité des intervenants">
        <PersonRow index={1} initial="C" name="Camille" status={current.camille} />
        <PersonRow index={2} initial="A" name="Alex" status={current.alex} />
        <PersonRow index={3} initial="S" name="Sofiane" status={current.sofiane} />
      </ol>

      <div className="mt-3.5 min-h-[92px] rounded-[14px] rounded-bl-[4px] border border-[#1d4a31] bg-[#0f2a1b] px-3.5 py-3 text-sm text-[#d9f7e4]">
        <p data-testid="landing-mission-whatsapp">Salut {current.recipient} 👋 Montage stand vendredi au Grand Palais, 7 h – 13 h. Tu es dispo ?</p>
        <p className="mt-1 text-xs text-[#7fbf98]">Envoyé depuis votre WhatsApp · réponse en 1 clic, sans appli</p>
      </div>
      {expanded && (
        <p data-testid="landing-mission-explanation" className="mt-3 text-xs leading-relaxed text-[#c4c4ce]">{current.explanation}</p>
      )}
      <div className="relative mt-3 flex min-h-7 items-center justify-center">
        <p className="text-center text-xs text-[#a1a1aa]">Exemple fictif</p>
        <button
          type="button"
          data-testid="landing-mission-playback"
          onClick={() => {
            if (reducedMotion) setPhase((previous) => (previous + 1) % missionPhases.length);
            else setPaused((previous) => !previous);
          }}
          aria-label={reducedMotion ? "Voir l’étape suivante" : paused ? "Reprendre l’animation" : "Mettre l’animation en pause"}
          title={reducedMotion ? "Étape suivante" : paused ? "Reprendre" : "Pause"}
          className="absolute right-0 flex h-8 w-8 items-center justify-center rounded-md text-[#a1a1aa] transition-colors hover:bg-[#2a2a2f] hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#25d366]"
        >
          {reducedMotion ? <SkipForward size={14} aria-hidden="true" /> : paused ? <Play size={14} aria-hidden="true" /> : <Pause size={14} aria-hidden="true" />}
        </button>
      </div>
    </div>
  );
}
