import React, { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import "./SignupCelebration.css";

const format = value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
const formatHours = value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);

function useCountUp() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const preference = window.matchMedia?.("(prefers-reduced-motion: reduce)");
    let frame;
    if (preference?.matches || !window.requestAnimationFrame) {
      setProgress(1); return;
    }
    let start;
    const animate = time => {
      if (start === undefined) start = time;
      const elapsed = Math.min(1, (time - start) / 1600);
      setProgress(1 - Math.pow(1 - elapsed, 3));
      if (elapsed < 1) frame = window.requestAnimationFrame(animate);
    };
    const reduceMotion = () => {
      if (preference.matches) { window.cancelAnimationFrame(frame); setProgress(1); }
    };
    preference?.addEventListener?.("change", reduceMotion);
    frame = window.requestAnimationFrame(animate);
    return () => {
      window.cancelAnimationFrame(frame);
      preference?.removeEventListener?.("change", reduceMotion);
    };
  }, []);
  return progress;
}

export default function SignupCelebration({ savings }) {
  const progress = useCountUp();
  return <div className="sf-signup-celebration" data-testid="register-savings">
    <div aria-hidden="true" className="sf-signup-confetti">
      {Array.from({ length: 26 }, (_, i) => <i key={i} style={{
        "--x": `${(i * 37 + 7) % 100}%`, "--drift": `${((i * 29) % 120) - 60}px`,
        "--delay": `${(i % 7) * 0.065}s`, "--color": ["#2563eb", "#8b5cf6", "#14b8a6", "#fbbf24", "#fb7185"][i % 5],
        "--turn": `${(i % 2 ? 1 : -1) * (240 + i * 23)}deg`,
      }} />)}
    </div>
    <div className="sf-signup-sparkles" aria-hidden="true"><Sparkles size={30} /></div>
    <p className="mt-5 text-center text-sm leading-relaxed text-gray-600">Avec ShiftFlow, vous pourriez économiser</p>
    <p className="sr-only">Estimation : {formatHours(savings.hours)} h par an et {format(savings.value)} € de temps valorisé.</p>
    <div className="sf-signup-stats" aria-hidden="true">
      <div><p className="sf-signup-stat">{formatHours(Math.round(savings.hours * progress * 10) / 10)}<span> h</span></p><p className="mt-2 text-xs text-gray-500">libérées par an</p></div>
      <div><p className="sf-signup-stat">{format(Math.round(savings.value * progress))}<span> €</span></p><p className="mt-2 text-xs text-gray-500">de temps valorisé par an</p></div>
    </div>
    <details className="sf-signup-assumptions">
      <summary>Estimation indicative · Voir le calcul</summary>
      <p>{savings.annualEvents} événements × ({savings.peoplePerMission} personnes × 6 min de relances et confirmations économisées + 30 min de préparation et de suivi gagnées par événement), à 35 €/h. Hypothèses de simulation, hors abonnement : cette valeur du temps libéré n’est pas une économie financière garantie.</p>
    </details>
  </div>;
}
