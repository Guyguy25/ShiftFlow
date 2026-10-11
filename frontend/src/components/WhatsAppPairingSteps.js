import React, { useEffect, useRef } from "react";
import { Check, RefreshCw } from "lucide-react";

export default function WhatsAppPairingSteps({ step, phone, onPhoneChange, code, secondsLeft, expired, feedback, pairing, starting, onRequestCode, onChangeNumber, connectionOnly }) {
  const heading = useRef(null);
  useEffect(() => {
    if (step === 2) {
      heading.current?.focus({ preventScroll: true });
      heading.current?.scrollIntoView?.({ block: "start", behavior: "smooth" });
    }
  }, [step]);

  return <div>
    <ol aria-label="Étapes de connexion" className="mb-5 flex items-center gap-3 text-sm">
      {["Votre numéro", "Lier WhatsApp"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`flex items-center gap-2 ${step === index + 1 ? "font-semibold text-blue-700" : "text-gray-500"}`}>
        <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${step >= index + 1 ? "bg-blue-600 text-white" : "bg-gray-100"}`}>{step > index + 1 ? <Check className="h-4 w-4" /> : index + 1}</span>{label}
        {index === 0 && <span aria-hidden="true" className="ml-1 text-gray-300">→</span>}
      </li>)}
    </ol>

    {step === 1 ? <form onSubmit={event => { event.preventDefault(); onRequestCode(); }} noValidate className="rounded-xl border border-gray-200 bg-gray-50 p-4 sm:p-5">
      <h4 className="font-semibold text-gray-900">Quel numéro utilisez-vous sur WhatsApp ?</h4>
      <p className="mt-2 text-sm text-gray-600">Saisissez le numéro du compte qui enverra vos demandes. Nous vous guiderons ensuite pour le connecter.</p>
      <label htmlFor="whatsapp-pair-phone" className="mt-5 block text-sm font-medium text-gray-800">Votre numéro WhatsApp</label>
      <input id="whatsapp-pair-phone" type="tel" inputMode="tel" autoComplete="tel" data-onboarding="phone" value={phone} onChange={event => onPhoneChange(event.target.value)} disabled={pairing} aria-invalid={!!feedback} aria-describedby={feedback ? "whatsapp-pair-feedback" : "whatsapp-phone-hint"} placeholder="+33 6 12 34 56 78" className="mt-2 h-12 w-full rounded-xl border border-gray-300 bg-white px-3 text-base focus:outline-none focus:ring-2 focus:ring-blue-500" />
      <p id="whatsapp-phone-hint" className="mt-2 text-xs text-gray-500">Incluez l’indicatif du pays, par exemple +33 pour la France.</p>
      {feedback && !pairing && <p id="whatsapp-pair-feedback" role="alert" className="mt-3 text-sm text-red-700">{feedback}</p>}
      <button type="submit" disabled={pairing || starting} className="mt-5 min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{pairing ? "Génération du code…" : "Obtenir mon code"}</button>
      <p className="mt-3 text-center text-xs text-gray-500">Étape suivante : entrez le code dans WhatsApp sur votre téléphone.</p>
    </form> : <div>
      <h4 ref={heading} tabIndex={-1} className="font-semibold text-gray-900 outline-none">Terminez la connexion sur votre téléphone</h4>
      <p className="mt-2 text-sm text-gray-600">Gardez cette page ouverte et suivez les instructions dans WhatsApp.</p>
      <div className="mt-4 grid items-start gap-5 md:grid-cols-2">
        <div className="md:sticky md:top-0">
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
            <p className="text-center text-sm font-medium text-gray-800">Code pour <span className="whitespace-nowrap">{phone}</span></p>
            {code && <div className="mt-3 break-all rounded-xl border-2 border-blue-200 bg-white px-3 py-4 text-center font-mono text-2xl font-bold tracking-[0.18em] text-gray-950">{code}</div>}
            {code && secondsLeft != null && <p role="timer" aria-live="off" className="mt-3 text-center text-sm font-semibold text-blue-800">Expire dans {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}</p>}
            {code && <p className="mt-2 text-center text-xs text-gray-600">Saisissez ce code dans WhatsApp avant son expiration.</p>}
            {feedback && !pairing && <p role="alert" className="mt-3 text-sm text-red-700">{feedback}</p>}
            {!code && <button type="button" onClick={onRequestCode} disabled={pairing || starting} className="mt-3 min-h-12 w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-50">{pairing ? "Génération du code…" : expired || feedback ? "Générer un nouveau code" : "Obtenir mon code"}</button>}
          </div>
          <ol className="mt-4 space-y-3 text-sm text-gray-700">
            {[<>Ouvrez <strong>WhatsApp sur votre téléphone</strong>, puis <strong>Appareils connectés</strong> (dans Paramètres ou le menu ⋮).</>, <>Appuyez sur <strong>Connecter un appareil</strong>.</>, <>Choisissez <strong>Connecter plutôt avec un numéro de téléphone</strong>.</>, <>Saisissez le code affiché ici, puis revenez sur <strong>ShiftFlow</strong>.</>].map((instruction, index) => <li key={index} className="flex items-start gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-100 text-xs font-bold text-green-800">{index + 1}</span><span>{instruction}</span></li>)}
          </ol>
          {code && <p role="status" className="mt-4 flex items-center gap-2 text-sm text-gray-500"><RefreshCw className="h-4 w-4 shrink-0 animate-spin" />En attente de la connexion WhatsApp…</p>}
          <p className="mt-3 text-xs text-gray-500">{connectionOnly ? "Après la connexion, vous pourrez reprendre votre mission." : "Après la connexion, vos contacts apparaîtront automatiquement."}</p>
          <button type="button" disabled={pairing} onClick={onChangeNumber} className="mt-2 min-h-11 text-sm font-medium text-blue-700 underline disabled:opacity-50">Utiliser un autre numéro</button>
        </div>
        <div>
          <h4 className="mb-3 text-sm font-semibold text-gray-900">Guide en images</h4>
          <img src="/phone-link-guide.png" alt="Étapes pour connecter WhatsApp avec un numéro de téléphone" className="block h-auto w-full rounded-xl border border-gray-200 shadow-sm" />
        </div>
      </div>
    </div>}
  </div>;
}
