import FirstMissionHelp from "../components/FirstMissionHelp";
import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { Mail, PlayCircle, Compass, ArrowRight } from "lucide-react";
import { LEGAL } from "../constants/legal";
import { useAuth } from "../context/AuthContext";

export default function Tutorial() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const replay = () => {
    try { Object.keys(localStorage).filter(key => key.startsWith(`shiftflow_guide_${user.id}_`)).forEach(key => localStorage.removeItem(key)); } catch {}
    window.dispatchEvent(new Event("shiftflow:replay-guide"));
    navigate("/app/dashboard");
  };
  return <div data-testid="help-page" className="max-w-4xl">
    <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Aide</p>
    <h1 className="mt-2 text-3xl font-display font-bold">Un coup de main, au bon moment.</h1>
    <p className="mt-3 text-gray-600">Suivez les indications dans l’application, écrivez-nous ou regardez le tutoriel à votre rythme.</p>
    <div className="mt-7 grid gap-4 sm:grid-cols-2">
      <section className="rounded-2xl border border-gray-200 bg-white p-6"><Mail className="text-blue-600" /><h2 className="mt-4 text-lg font-bold">Contacter le support</h2><p className="mt-2 text-sm leading-relaxed text-gray-600">Décrivez l’étape qui vous bloque. Nous vous aiderons à avancer.</p><a className="mt-4 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700 break-all" href={`mailto:${LEGAL.email}?subject=Besoin%20d’aide%20sur%20ShiftFlow`}>{LEGAL.email}</a></section>
      <section className="rounded-2xl border border-gray-200 bg-white p-6"><Compass className="text-blue-600" /><h2 className="mt-4 text-lg font-bold">Reprendre les premiers pas</h2><p className="mt-2 text-sm leading-relaxed text-gray-600">Réaffichez les conseils contextuels. Vos missions et votre progression sont conservées.</p><button onClick={replay} className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-blue-700">Réafficher les conseils<ArrowRight size={16} /></button></section>
    </div>
    <FirstMissionHelp />
    <details className="mt-6 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
      <summary className="cursor-pointer text-lg font-semibold"><span className="inline-flex items-center gap-2"><PlayCircle size={21} className="text-blue-600" />Voir le tutoriel vidéo</span></summary>
      <p className="mt-3 text-sm text-gray-600">Une démonstration complète, si vous préférez voir les étapes avant de vous lancer.</p>
      <video className="mt-5 block w-full aspect-video rounded-xl bg-black" src="/video-tutorial.mp4" controls preload="none" playsInline aria-label="Tutoriel de prise en main de ShiftFlow" />
    </details>
    <Link to="/app/dashboard" className="mt-6 inline-flex min-h-11 items-center text-sm font-medium text-blue-700">Retour à mon espace →</Link>
  </div>;
}
