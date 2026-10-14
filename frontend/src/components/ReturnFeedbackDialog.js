import React, { useEffect, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { Link } from "react-router-dom";
import { Gift, X } from "lucide-react";
import { api, formatApiError } from "../lib/api";

const questions = [
  ["activity", "Votre activité et les événements que vous organisez", 2, 200],
  ["role", "Votre rôle dans la structure", 2, 120],
  ["current_tools", "Quels outils utilisez-vous aujourd’hui ?", 2, 500],
  ["workflow", "Comment organisez-vous une mission, du planning aux confirmations ?", 30, 2000],
  ["main_obstacle", "Quel est votre principal blocage avec ShiftFlow ? Donnez un exemple concret.", 30, 2000],
  ["desired_improvement", "Quelle amélioration vous aiderait le plus ? Décrivez le résultat attendu.", 30, 2000],
  ["impact", "Combien de temps perdez-vous et quelles conséquences pour votre équipe ?", 15, 1000],
];
const field = "mt-2 w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-100";

export default function ReturnFeedbackDialog({ user }) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState("invite");
  const [answers, setAnswers] = useState({ follow_up: false });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    const check = () => {
      if (document.visibilityState === "hidden") return;
      api.get("/feedback/status").then(({ data }) => {
        let welcomePending = false;
        try { welcomePending = localStorage.getItem(`shiftflow-welcome-${user.id}`) === "pending"; } catch {}
        if (!cancelled && data.show && !welcomePending) setOpen(true);
      }).catch(() => {});
    };
    check();
    const timer = window.setInterval(check, 5 * 60 * 1000);
    window.addEventListener("focus", check);
    document.addEventListener("visibilitychange", check);
    return () => { cancelled = true; window.clearInterval(timer); window.removeEventListener("focus", check); document.removeEventListener("visibilitychange", check); };
  }, [user.id]);
  const update = (name, value) => setAnswers(previous => ({ ...previous, [name]: value }));
  const close = async () => {
    if (busy) return;
    if (step === "done") { setOpen(false); return; }
    setBusy(true); setError("");
    try { await api.post("/feedback/snooze"); setOpen(false); }
    catch { setError("Impossible de reporter l’invitation. Réessayez."); }
    finally { setBusy(false); }
  };
  const submit = async event => {
    event.preventDefault(); setBusy(true); setError("");
    try {
      const { data } = await api.post("/feedback", answers);
      setCode(data.promo_code); setStep("done");
    } catch (err) { setError(formatApiError(err.response?.data?.detail) || "Vos réponses n’ont pas pu être enregistrées. Réessayez."); }
    finally { setBusy(false); }
  };
  return <Dialog.Root open={open} onOpenChange={value => { if (!value) close(); }}>
    <Dialog.Portal>
      <Dialog.Overlay className="fixed inset-0 z-[80] bg-gray-950/50 backdrop-blur-sm" />
      <Dialog.Content className="fixed left-1/2 top-1/2 z-[90] max-h-[90dvh] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl sm:p-8">
        <button type="button" onClick={close} disabled={busy} aria-label="Fermer" className="absolute right-4 top-4 rounded-full p-2 text-gray-500 hover:bg-gray-100"><X size={20}/></button>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-600"><Gift size={25}/></div>
        <Dialog.Title className="pr-6 text-2xl font-bold tracking-tight">{step === "done" ? "Merci ! Vos deux mois vous attendent." : "Votre avis nous intéresse"}</Dialog.Title>
        <Dialog.Description className="mt-3 text-sm leading-relaxed text-gray-600">
          Nous voulons adapter ShiftFlow à votre façon de travailler. Vos retours concrets nous aideront à choisir les améliorations les plus utiles pour votre équipe.
        </Dialog.Description>
        {error && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}
        {step === "invite" && <>
          <div className="mt-6 rounded-2xl bg-blue-50 p-5"><p className="text-xl font-bold text-blue-900">2 mois de Pro offerts pour vous remercier</p><p className="mt-2 text-sm leading-relaxed text-blue-900">Répondez à notre questionnaire détaillé (environ 5 minutes) et recevez votre code personnel de −100 % pendant deux mois. L’offre récompense votre participation, quel que soit votre avis.</p></div>
          <button onClick={() => setStep("form")} className="mt-6 min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">Donner mon avis et recevoir mes 2 mois</button>
          <button onClick={close} disabled={busy} className="mt-2 min-h-11 w-full text-sm text-gray-500">Plus tard</button>
        </>}
        {step === "form" && <form onSubmit={submit} className="mt-6 space-y-5">
          <fieldset disabled={busy} className="space-y-5">
            {questions.map(([name, label, min, max]) => <label key={name} className="block text-sm font-semibold text-gray-900">{label}
              {min >= 15 ? <textarea required minLength={min} maxLength={max} rows={3} className={field} value={answers[name] || ""} onChange={e => update(name, e.target.value)} placeholder={`Un exemple précis nous aide (au moins ${min} caractères).`} /> : <input required minLength={min} maxLength={max} className={field} value={answers[name] || ""} onChange={e => update(name, e.target.value)} />}
            </label>)}
            <div className="grid grid-cols-2 gap-4">
              {[['team_size', 'Taille de l’équipe', ['1–5', '6–20', '21–50', '51–100', '100+']], ['monthly_missions', 'Missions par mois', ['1–3', '4–10', '11–30', '30+']]].map(([name, label, options]) => <label key={name} className="text-sm font-semibold">{label}<select required className={field} value={answers[name] || ""} onChange={e => update(name, e.target.value)}><option value="">Choisir</option>{options.map(option => <option key={option}>{option}</option>)}</select></label>)}
            </div>
            <label className="block text-sm font-semibold">Votre satisfaction avec ShiftFlow (1 à 10)<select required className={field} value={answers.satisfaction || ""} onChange={e => update("satisfaction", Number(e.target.value))}><option value="">Choisir une note</option>{Array.from({ length: 10 }, (_, i) => <option key={i} value={i + 1}>{i + 1}{i === 0 ? " — Très insatisfait" : i === 9 ? " — Très satisfait" : ""}</option>)}</select></label>
            <label className="flex items-start gap-3 text-sm text-gray-600"><input type="checkbox" className="mt-1" checked={answers.follow_up} onChange={e => update("follow_up", e.target.checked)}/>Vous pouvez me recontacter par e-mail pour approfondir mes besoins (facultatif).</label>
            <p className="text-xs text-gray-500">Vos réponses sont accessibles à l’équipe ShiftFlow pour améliorer l’outil. <Link to="/confidentialite" target="_blank" className="underline">Confidentialité</Link></p>
            <button type="submit" className="min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">{busy ? "Enregistrement…" : "Envoyer mon avis et obtenir mon code"}</button>
          </fieldset>
        </form>}
        {step === "done" && <div className="mt-6">
          <p className="text-sm text-gray-600">Votre code personnel, utilisable une fois sur Pro mensuel :</p>
          <p className="mt-3 break-all rounded-xl border border-dashed border-blue-300 bg-blue-50 p-4 text-center font-mono font-bold text-blue-800">{code}</p>
          <Link to={`/pricing?feedback=${encodeURIComponent(code)}`} onClick={() => setOpen(false)} className="mt-5 flex min-h-12 items-center justify-center rounded-xl bg-blue-600 px-4 py-3 text-center font-semibold text-white">Activer mes 2 mois gratuits</Link>
          <p className="mt-3 text-xs text-gray-500">Votre code reste disponible sur la page Tarifs.</p>
        </div>}
        <p className="mt-5 text-xs leading-relaxed text-gray-500">Offre réservée aux comptes sans abonnement Pro, une fois par compte. Carte bancaire requise à l’activation. 0 € pendant deux mois, puis 49 €/mois automatiquement. Résiliable à tout moment depuis votre compte, avant la prochaine échéance pour éviter le prélèvement.</p>
      </Dialog.Content>
    </Dialog.Portal>
  </Dialog.Root>;
}
