import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import { api } from "../lib/api";
import CalendlyInlineBooking from "./CalendlyInlineBooking";

const questions = [
  { key: "monthly_missions", compact: true, title: "Combien de missions organisez-vous par mois ?", hint: "Une estimation suffit, même si votre activité varie selon la saison.", options: ["1 à 3", "4 à 10", "11 à 20", "Plus de 20", "Activité ponctuelle / variable"] },
  { key: "team_size", compact: true, title: "Combien d’intervenants réunissez-vous par mission ?", hint: "Pensez à votre équipe habituelle, pas forcément au plus gros événement.", options: ["1 à 5", "6 à 10", "11 à 20", "Plus de 20"] },
  { key: "need", title: "Que souhaitez-vous simplifier en priorité ?", options: ["Les messages et les relances", "Les remplacements après un désistement", "Le suivi des confirmations", "La coordination globale de mes équipes", "Je souhaite découvrir l’outil"] },
  { key: "mission", title: "Quand avez-vous une prochaine mission à préparer ?", options: ["Dans les 7 prochains jours", "Dans les 30 prochains jours", "Plus tard / date à définir"] },
];
const primary = "inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";
function Choices({ question, value, onChange }) {
  return <fieldset className="min-w-0"><legend className="text-base font-semibold leading-snug text-slate-950">{question.title}</legend>
    {question.hint && <p className="mt-2 text-sm leading-relaxed text-slate-500">{question.hint}</p>}
    <div className={`mt-3 grid gap-2 ${question.compact ? "grid-cols-2" : "sm:grid-cols-2"}`}>{question.options.map((option, index) => <label key={option} className={`${question.compact && index === 4 ? "col-span-2" : ""} relative flex min-h-12 cursor-pointer items-center gap-3 rounded-xl border px-4 py-3 text-sm transition-colors focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${value === option ? "border-blue-600 bg-blue-50 text-blue-900" : "border-slate-200 bg-white text-slate-700 hover:border-blue-300"}`}>
      <input type="radio" name={question.key} value={option} checked={value === option} onChange={() => onChange(question.key, option)} className="sr-only" />
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${value === option ? "border-blue-600 bg-blue-600 text-white" : "border-slate-300"}`} aria-hidden="true">{value === option && <Check size={13} />}</span><span>{option}</span>
    </label>)}</div></fieldset>;
}
export default function DemoQualification() {
  const [stage, setStage] = useState(0);
  const [values, setValues] = useState({ name: "", email: "", company: "", monthly_missions: "", team_size: "", need: "", mission: "" });
  const [booking, setBooking] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const title = useRef(null), navigated = useRef(false), inFlight = useRef(false);
  useEffect(() => {
    if (!navigated.current) { navigated.current = true; return; }
    title.current?.focus({ preventScroll: true });
    title.current?.scrollIntoView?.({ block: "start", behavior: "auto" });
  }, [stage, booking]);
  const update = (key, value) => setValues(current => ({ ...current, [key]: value }));
  const currentQuestions = questions.slice(stage * 2, stage * 2 + 2);
  const ready = stage === 2 || currentQuestions.every(question => values[question.key]);
  const submit = async event => {
    event.preventDefault();
    if (!ready || inFlight.current) return;
    if (stage < 2) { setStage(stage + 1); return; }
    inFlight.current = true;
    setSaving(true); setError("");
    try {
      await api.post("/public/accompanied-trial", Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()])));
      setBooking(true);
    } catch (err) {
      setError(err.response?.status === 429 ? "Trop de demandes rapprochées. Réessayez plus tard ou écrivez à contact@shiftflow.io." : "Votre demande n’a pas pu être enregistrée. Vos réponses sont conservées ici : réessayez ou écrivez à contact@shiftflow.io.");
    } finally { inFlight.current = false; setSaving(false); }
  };
  return <div className={`mx-auto ${booking ? "max-w-5xl" : "max-w-2xl"}`}>
    <ol aria-label="Étapes de réservation" className="mb-6 grid grid-cols-4 gap-2 text-center text-[11px] font-semibold sm:text-xs">{["Votre activité", "Votre besoin", "Vos coordonnées", "Votre créneau"].map((label, index) => <li key={label} aria-current={index === (booking ? 3 : stage) ? "step" : undefined} className={index <= (booking ? 3 : stage) ? "text-blue-700" : "text-slate-400"}><div className={`mb-2 h-1 rounded-full ${index <= (booking ? 3 : stage) ? "bg-blue-600" : "bg-slate-200"}`} />{label}</li>)}</ol>
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
      <h3 ref={title} tabIndex={-1} className="scroll-mt-6 text-2xl font-bold tracking-tight outline-none">{booking ? "Choisissez votre rendez-vous." : ["Parlons de votre activité.", "Préparons une démo utile pour vous.", "À qui s’adresse la démo ?"][stage]}</h3>
      <p className="mt-2 text-sm leading-relaxed text-slate-500">{booking ? "25 minutes en visio avec Tanguy. Le rendez-vous sera confirmé après validation du créneau dans l’agenda." : stage === 2 ? "Ces coordonnées servent à préparer votre échange. Elles seront préremplies dans l’agenda." : "Sélectionnez une réponse par question. Vous pourrez revenir en arrière."}</p>
      {booking ? <div data-testid="booking-inline-step"><CalendlyInlineBooking name={values.name.trim()} email={values.email.trim()} /><button type="button" onClick={() => setBooking(false)} className="mt-4 min-h-11 text-sm font-semibold text-blue-700 underline">Modifier mes informations</button></div> : <form onSubmit={submit} className="mt-7">
        {stage < 2 ? <div className="space-y-7">{currentQuestions.map(question => <Choices key={question.key} question={question} value={values[question.key]} onChange={update} />)}</div> : <div className="space-y-5">
          {[["name", "Votre nom", "text", "name"], ["email", "Votre email professionnel", "email", "email"], ["company", "Votre entreprise ou votre activité", "text", "organization"]].map(([key, label, type, autoComplete]) => <label key={key} className="block text-sm font-semibold text-slate-800">{label}<input name={key} type={type} autoComplete={autoComplete} required maxLength={150} value={values[key]} onChange={event => update(key, event.target.value)} pattern={type === "text" ? ".*\\S.*" : undefined} className="mt-2 min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base font-normal outline-none focus:border-blue-600 focus:ring-2 focus:ring-blue-100" /></label>)}
          <p className="text-xs leading-relaxed text-slate-500">Vos réponses sont conservées 90 jours pour préparer et suivre votre demande. En continuant, l’agenda Calendly reçoit votre nom et votre email. <Link to="/confidentialite" className="text-blue-700 underline">Confidentialité</Link>.</p>
        </div>}
        {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        <div className="mt-7 flex items-center gap-3">{stage > 0 && <button type="button" disabled={saving} onClick={() => { setStage(stage - 1); setError(""); }} className="inline-flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold text-slate-600 hover:bg-slate-100 disabled:opacity-50"><ArrowLeft size={16} aria-hidden="true" />Retour</button>}<button type="submit" disabled={!ready || saving} className={`${primary} flex-1`}>{saving ? "Enregistrement…" : stage === 2 ? "Voir les créneaux disponibles" : "Continuer"}<ArrowRight size={17} aria-hidden="true" /></button></div>
        <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">Sans engagement · Aucun compte ni paiement demandé</p>
      </form>}
    </div>
  </div>;
}
