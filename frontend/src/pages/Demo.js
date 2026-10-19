import React, { useEffect, useRef, useState } from "react";
import TeamProgress from "../components/TeamProgress";
import { Link } from "react-router-dom";
import { ArrowLeft, ArrowRight, CalendarDays, Check, CheckCircle2, ChevronUp, Clock3, MapPin, MessageCircle, RotateCcw, ShieldCheck, Users, Zap } from "lucide-react";
import { useAuth } from "../context/AuthContext";

const initialMission = { name: "Montage de scène · équipe road", location: "Lille · Grand Palais" };
const people = [{ name: "Camille", initials: "CM", color: "bg-violet-100 text-violet-700" }, { name: "Alex", initials: "AL", color: "bg-amber-100 text-amber-800" }];
const phases = ["Votre mission", "Votre équipe", "Les réponses"];
const copy = [
  { title: "Préparez votre mission", text: "Ce montage nécessite 15 roadies. Dans cet exemple fictif, 14 ont déjà confirmé : complétez la dernière place.", action: "Continuer avec cette mission" },
  { title: "Qui contacter en premier ?", text: "Pour la dernière place de road, classez deux contacts fictifs. Les 14 autres personnes sont déjà confirmées dans ce scénario.", action: "Voir la demande WhatsApp" },
  { title: "La première demande est partie", text: "Votre intervenant reçoit les détails sur WhatsApp et répond via son lien.", action: "Simuler un refus" },
  { title: "ShiftFlow prend le relais", text: "Après le refus, la demande passe au suivant. Vous n’avez rien à renvoyer.", action: "Simuler la confirmation" },
  { title: "Vos 15 roadies sont confirmés", text: "La réponse est centralisée dans votre mission. Vous savez qui sera présent." },
];
const primary = "inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-center text-sm font-semibold text-white transition-colors hover:bg-blue-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600 disabled:cursor-not-allowed disabled:opacity-50";

function Avatar({ person, small = false }) {
  return <span className={`flex shrink-0 items-center justify-center rounded-full font-semibold ${small ? "h-9 w-9 text-xs" : "h-11 w-11 text-sm"} ${person.color}`} aria-hidden="true">{person.initials}</span>;
}

export default function Demo() {
  const { user } = useAuth();
  const [step, setStep] = useState(0);
  const [mission, setMission] = useState(initialMission);
  const [firstIndex, setFirstIndex] = useState(0);
  const titleRef = useRef(null);
  const hasNavigated = useRef(false);
  const phase = step === 0 ? 0 : step === 1 ? 1 : 2;
  const first = people[firstIndex], second = people[1 - firstIndex];
  const order = [first, second];
  const recipient = step < 3 ? first : second;
  const completed = step === 4;
  const current = copy[step];
  const valid = mission.name.trim() && mission.location.trim();
  useEffect(() => {
    if (!hasNavigated.current) { hasNavigated.current = true; return; }
    titleRef.current?.focus({ preventScroll: true });
    if (window.matchMedia("(max-width: 1023px)").matches) titleRef.current?.scrollIntoView({ block: "start", behavior: "auto" });
  }, [step]);
  const reset = () => { setStep(0); setMission(initialMission); setFirstIndex(0); };

  return <div className="min-h-screen bg-[#f5f7fb] text-slate-900" data-testid="mission-demo">
    <header className="border-b border-slate-200 bg-white">
      <div className="mx-auto flex min-h-16 max-w-6xl items-center justify-between gap-3 px-5 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2 text-lg font-bold tracking-tight"><Zap size={21} className="text-blue-600" aria-hidden="true"/>ShiftFlow<span className="rounded-md bg-blue-50 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-700">Démo</span></Link>
        <Link to={user ? "/app/dashboard" : "/"} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-slate-500 hover:text-blue-700"><ArrowLeft size={16} aria-hidden="true"/><span>Retour<span className="hidden sm:inline"> à {user ? "mon espace" : "ShiftFlow"}</span></span></Link>
      </div>
    </header>
    <main className="mx-auto max-w-6xl px-5 pb-40 pt-6 sm:px-8 sm:pt-8">
      <div className="mb-5 max-w-4xl">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-blue-700">Prenez les commandes, sans inscription</p>
        <h1 className="mt-3 text-3xl font-bold leading-tight tracking-tight sm:text-4xl">De votre mission à votre équipe confirmée.</h1>
        <p className="mt-3 text-base leading-relaxed text-slate-600">Complétez une équipe de 15 roadies pour un montage de scène. Découvrez les propositions WhatsApp et les réponses via un lien personnel.</p>
      </div>
      <ol aria-label="Progression de la démo" className="mb-6 grid grid-cols-3 rounded-xl border border-slate-200 bg-white p-2 sm:max-w-2xl">
        {phases.map((label, index) => <li key={label} aria-current={index === phase ? "step" : undefined} className={`flex flex-col items-center justify-center gap-2 rounded-lg px-1 py-2 text-center text-xs font-semibold sm:flex-row sm:text-sm ${index === phase ? "bg-blue-50 text-blue-700" : "text-slate-500"}`}><span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${index < phase || completed ? "bg-emerald-100 text-emerald-700" : index === phase ? "bg-blue-600 text-white" : "bg-slate-100"}`}>{index < phase || completed ? <Check size={14} aria-hidden="true"/> : index + 1}</span><span>{label}</span></li>)}
      </ol>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_300px]">
        <section className="min-w-0 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_40px_-24px_rgba(15,23,42,0.25)]" aria-labelledby="demo-stage-title">
          <div className="flex min-h-14 items-center justify-between gap-3 border-b border-slate-100 px-5 sm:px-7"><span className="inline-flex min-w-0 items-center gap-2 text-xs font-semibold text-slate-500"><span className="h-2 w-2 shrink-0 rounded-full bg-blue-500"/><span className="truncate">{step === 0 ? "Nouvelle mission" : mission.name}</span></span><span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-slate-500">Exemple interactif</span></div>
          <div className="p-5 sm:p-7">
            <h2 id="demo-stage-title" tabIndex={-1} ref={titleRef} className="scroll-mt-6 text-xl font-bold tracking-tight outline-none sm:text-2xl">{current.title}</h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-500" aria-live="polite">{current.text}</p>

            {step === 0 && <div className="mt-5 grid gap-4 sm:grid-cols-2">
              <div><label htmlFor="demo-name" className="mb-2 block text-sm font-semibold">Nom de la mission</label><input id="demo-name" maxLength={80} value={mission.name} onChange={e => setMission({ ...mission, name: e.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></div>
              <div><label htmlFor="demo-location" className="mb-2 block text-sm font-semibold">Lieu</label><div className="relative"><MapPin size={17} className="absolute left-4 top-4 text-slate-400" aria-hidden="true"/><input id="demo-location" maxLength={100} value={mission.location} onChange={e => setMission({ ...mission, location: e.target.value })} className="min-h-12 w-full rounded-xl border border-slate-200 bg-white pl-11 pr-4 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"/></div></div>
              <div className="grid grid-cols-2 gap-3 sm:col-span-2"><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={15} aria-hidden="true"/>Créneau d’exemple</p><p className="mt-2 text-sm font-semibold">Vendredi · 8 h – 12 h</p></div><div className="rounded-xl border border-slate-200 bg-slate-50 p-4"><p className="flex items-center gap-2 text-xs text-slate-500"><Users size={15} aria-hidden="true"/>Besoin</p><p className="mt-2 text-sm font-semibold">15 roadies</p></div></div>
              <p className="text-xs leading-relaxed text-slate-500 sm:col-span-2">Les champs sont préremplis pour aller à l’essentiel. Vous pouvez modifier le nom et le lieu.</p>
            </div>}

            <TeamProgress complete={completed} />
            {step === 1 && <div className="mt-6"><div className="mb-3 flex items-center justify-between gap-2"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Dernière place · ordre de priorité</p><span className="text-xs text-slate-400">Contacts fictifs</span></div><ol className="space-y-3">{order.map((person, index) => <li key={person.name} className={`flex items-center gap-3 rounded-xl border p-4 ${index === 0 ? "border-blue-200 bg-blue-50/50" : "border-slate-200"}`}><span className="text-xs font-semibold text-slate-400">0{index + 1}</span><Avatar person={person}/><div className="min-w-0 flex-1"><p className="font-semibold">{person.name}</p><p className="mt-0.5 text-xs text-slate-500">{index === 0 ? "À contacter en premier" : "Contacté si la place reste libre"}</p></div>{index === 1 && <button type="button" onClick={() => setFirstIndex(1 - firstIndex)} aria-label={`Contacter ${person.name} en premier`} className="flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 hover:border-blue-300 hover:text-blue-700"><ChevronUp size={18}/></button>}</li>)}</ol><div className="mt-4 flex items-start gap-2 rounded-xl bg-slate-50 p-4 text-sm leading-relaxed text-slate-600"><Users size={18} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true"/><p>Dans ShiftFlow, vous ajoutez ou importez <strong>vos propres intervenants</strong>. L’outil ne fournit pas de personnel.</p></div></div>}

            {(step === 2 || step === 3) && <div className="mt-6">
              {step === 3 && <div className="mb-4 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-sm text-blue-900"><Zap size={17} className="mt-0.5 shrink-0" aria-hidden="true"/><p><strong>{first.name} a refusé.</strong> ShiftFlow sollicite {second.name} automatiquement.</p></div>}
              <div className="overflow-hidden rounded-xl border border-emerald-100"><div className="flex items-center gap-3 border-b border-emerald-100 bg-white px-4 py-3"><Avatar person={recipient} small/><div className="flex-1"><p className="text-sm font-semibold">{recipient.name}</p><p className="text-xs text-slate-500">Ce que votre intervenant reçoit</p></div><MessageCircle size={20} className="text-emerald-600" aria-hidden="true"/></div><div className="bg-[#edf5f0] p-4 sm:p-5"><div className="max-w-md rounded-2xl rounded-tr-sm border border-emerald-100 bg-[#dcf8c6] p-4 text-sm leading-relaxed text-slate-800"><p>Bonjour {recipient.name} 👋</p><p className="mt-3">Une mission vous est proposée :</p><p className="mt-2 font-semibold">{mission.name}</p><p>{mission.location}<br/>Vendredi, de 8 h à 12 h</p><div className="mt-3 border-t border-emerald-800/10 pt-3 font-semibold text-blue-700">Lien personnel pour accepter ou refuser</div></div><p className="mt-3 text-[11px] text-emerald-900/60">Aperçu WhatsApp illustratif · aucun message envoyé</p></div></div>
              <div className="mt-4 flex items-start gap-2 text-sm leading-relaxed text-slate-600"><ArrowRight size={17} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true"/><p>{step === 2 ? `Pour voir la suite, simulons le refus de ${first.name} via son lien de réponse.` : `Simulons maintenant l’acceptation de ${second.name} via son lien. Aucun compte n’est nécessaire pour répondre.`}</p></div>
            </div>}

            {completed && <div className="mt-6" data-testid="demo-success"><div className="rounded-xl border border-emerald-200 bg-emerald-50 p-5"><div className="flex items-center gap-3"><CheckCircle2 size={28} className="shrink-0 text-emerald-600" aria-hidden="true"/><div><p className="font-semibold text-emerald-900">L’équipe de l’exemple est complète.</p><p className="mt-1 text-xs text-emerald-700">15 personnes confirmées sur 15 demandées · dont 14 déjà confirmées au début de l’exemple</p></div></div><div className="mt-5 flex items-center gap-3 rounded-xl bg-white p-3"><Avatar person={second}/><div className="flex-1"><p className="text-sm font-semibold">{second.name}</p><p className="text-xs text-slate-500">Vendredi · 8 h – 12 h</p></div><span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-800">Confirmé</span></div></div><h3 className="mt-6 text-xl font-bold">À votre tour, avec votre équipe.</h3><p className="mt-2 text-sm leading-relaxed text-slate-600">{user ? "Préparez votre vraie mission et vérifiez les destinataires avant tout envoi." : "Vos trois premières missions sont offertes, sans carte bancaire ni date limite."}</p><Link to={user ? "/app/missions/new" : "/register"} data-testid="demo-success-cta" className={primary + " mt-5"}>{user ? "Préparer ma vraie mission" : "Créer ma première mission"}<ArrowRight size={17} aria-hidden="true"/></Link></div>}

            {!valid && <p role="status" className="mt-4 text-sm text-amber-700">Renseignez le nom et le lieu de la mission pour continuer.</p>}
            {!completed && <button type="button" onClick={() => setStep(step + 1)} disabled={!valid} data-testid="demo-next" className={primary + " mt-6"}>{current.action}<ArrowRight size={17} aria-hidden="true"/></button>}
            <div className="mt-4 flex items-center justify-between gap-3">{step > 0 && !completed ? <button type="button" onClick={() => setStep(step - 1)} className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"><ArrowLeft size={14} aria-hidden="true"/>Retour</button> : <span/>}{step > 0 && <button type="button" onClick={reset} className="inline-flex min-h-11 items-center gap-1.5 text-xs font-medium text-slate-500 hover:text-blue-700"><RotateCcw size={14} aria-hidden="true"/>Recommencer la démo</button>}</div>
          </div>
        </section>
        <aside className="space-y-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Votre mission d’exemple</p><h2 className="mt-3 break-words text-lg font-bold">{mission.name || "Votre mission"}</h2><p className="mt-2 flex items-start gap-2 text-sm text-slate-500"><MapPin size={15} className="mt-0.5 shrink-0" aria-hidden="true"/>{mission.location || "Votre lieu"}</p><p className="mt-2 flex items-center gap-2 text-sm text-slate-500"><Clock3 size={15} aria-hidden="true"/>Vendredi · 8 h – 12 h</p><div className="mt-5 border-t border-slate-100 pt-4"><p className="text-xs font-semibold text-slate-400">DERNIÈRE PLACE · RÉPONSES</p><ul className="mt-3 space-y-3">{order.map((person, index) => <li key={person.name} className="flex items-center gap-2 text-sm"><Avatar person={person} small/><span className="flex-1 font-medium">{person.name}</span><span className={`text-xs ${index === 0 && step >= 3 ? "text-slate-400" : index === 1 && completed ? "font-semibold text-emerald-700" : "text-blue-700"}`}>{index === 0 ? step >= 3 ? "A refusé" : step === 2 ? "Demande envoyée" : "Priorité 1" : completed ? "Confirmé" : step === 3 ? "Contacté" : "En attente"}</span></li>)}</ul></div></div>
          <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4"><ShieldCheck size={20} className="mt-0.5 shrink-0 text-blue-600" aria-hidden="true"/><div><p className="text-sm font-semibold text-blue-950">Vous pouvez tout essayer ici.</p><p className="mt-1 text-xs leading-relaxed text-blue-900/70">Sans inscription, sans connexion WhatsApp, sans envoi réel. Aucune mission n’est consommée.</p></div></div>
          <p className="px-1 text-xs leading-relaxed text-slate-400">Scénario fictif : 14 confirmations initiales, puis une dernière place à compléter. Le remplissage d’une vraie mission dépend des réponses de vos intervenants.</p>
        </aside>
      </div>
      {!completed && <p className="mt-6 text-center text-sm text-slate-500">Déjà convaincu ? <Link to={user ? "/app/missions/new" : "/register"} className="inline-flex min-h-11 items-center font-semibold text-blue-700 hover:underline">{user ? "Préparer une vraie mission" : "Créer mon compte gratuit"}</Link></p>}
    </main>
  </div>;
}
