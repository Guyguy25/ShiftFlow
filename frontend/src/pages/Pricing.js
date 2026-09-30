import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, ArrowLeft, Loader2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { LEGAL_VERSION } from "../constants/legal";

const features = ["Intervenants illimités", "Demandes et rappels WhatsApp", "Cascade automatique", "Suivi des réponses et historique"];
export default function Pricing() {
  const { user } = useAuth();
  const [quota, setQuota] = useState(null);
  const [checking, setChecking] = useState(!!user);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const consentRef = useRef(null);
  const [volume, setVolume] = useState(5);
  useEffect(() => {
    let cancelled = false;
    if (!user) { setChecking(false); return; }
    setChecking(true);
    api.get("/plan/quota").then(({ data }) => { if (!cancelled) setQuota(data); })
      .catch(() => { if (!cancelled) setError("Impossible de vérifier votre offre. Rechargez la page avant de payer."); })
      .finally(() => { if (!cancelled) setChecking(false); });
    return () => { cancelled = true; };
  }, [user]);
  const pro = quota?.plan === "pro" || user?.plan === "pro";
  const available = !!quota?.can_create_mission;
  const checkout = async (lookup) => {
    if (!user) { window.location.href = "/register"; return; }
    if (!accepted) {
      setConsentError(true);
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      consentRef.current?.querySelector("input")?.focus();
      return;
    }
    if (loading) return;
    setLoading(lookup); setError("");
    try {
      const { data } = await api.post("/payments/checkout", {
        lookup_key: lookup, origin_url: window.location.origin,
        legal_acceptance: { version: LEGAL_VERSION, accepted_at: new Date().toISOString(), scope: lookup === "shiftflow_mission" ? "mission_purchase" : "pro_subscription" },
        meta_consent: localStorage.getItem("shiftflow_cookie_consent") === "accepted",
      });
      window.location.href = data.checkout_url;
    } catch (err) { setError(formatApiError(err.response?.data?.detail) || "Le paiement n’a pas pu être ouvert."); setLoading(null); }
  };
  const money = value => value.toLocaleString("fr-FR", { style: "currency", currency: "EUR" });
  const button = "mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed";
  return <div className="min-h-screen bg-[#F9FAFB]">
    <header className="border-b border-gray-100 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
      <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold"><Zap className="text-blue-600"/>ShiftFlow</Link>
      <Link to={user ? "/app/dashboard" : "/"} className="flex min-h-11 items-center gap-2 text-sm text-gray-600"><ArrowLeft size={16}/>Retour</Link>
    </div></header>
    <main className="mx-auto max-w-6xl px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold text-blue-700">À votre rythme, puis selon votre activité</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">Vos 3 premières missions sont offertes.</h1>
        <p className="mt-5 text-lg leading-relaxed text-gray-600">Sans carte bancaire, sans date limite. Ensuite, payez une mission quand vous en avez besoin ou choisissez l’illimité.</p>
      </div>
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      {pro && <p className="mt-6 text-center font-semibold text-emerald-700">Votre abonnement Pro est actif. Vos missions sont illimitées.</p>}
      <div className="mt-10 grid gap-5 lg:grid-cols-3">
        <section className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6" data-testid="pricing-card-free">
          <p className="text-sm font-semibold text-emerald-700">Pour découvrir</p><h2 className="mt-2 text-xl font-bold">3 missions offertes</h2>
          <p className="mt-5 text-4xl font-bold">0 €</p><p className="mt-2 text-sm text-gray-500">Une seule fois par compte · sans expiration</p>
          <p className="mt-5 flex-1 text-sm leading-relaxed text-gray-600">Testez ShiftFlow sur vos vrais événements. Aucun passage automatique au payant.</p>
          <Link to={user ? (available || pro ? "/app/missions/new" : "/app/dashboard") : "/register"} className={button + " border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"} data-testid="pricing-free-cta">
            {user ? quota ? (quota.free_missions_remaining ?? 0) + " mission(s) offerte(s) restante(s)" : "Ouvrir mon espace" : "Commencer gratuitement"}
          </Link>
        </section>
        <section className="flex flex-col rounded-2xl border-2 border-blue-200 bg-white p-6" data-testid="pricing-card-mission">
          <p className="text-sm font-semibold text-blue-700">Pour les besoins ponctuels</p><h2 className="mt-2 text-xl font-bold">À la mission</h2>
          <p className="mt-5 text-4xl font-bold">4,90 €<span className="text-base font-normal text-gray-500"> / mission</span></p><p className="mt-2 text-sm text-gray-500">Paiement unique · aucun abonnement</p>
          <p className="mt-5 flex-1 text-sm leading-relaxed text-gray-600">Un crédit pour créer votre prochaine mission, utilisable quand vous voulez. Son suivi reste accessible ensuite.</p>
          {available && !pro ? <Link to="/app/missions/new" className={button + " bg-blue-600 text-white hover:bg-blue-700"}>Utiliser ma mission disponible</Link> : <button onClick={() => checkout("shiftflow_mission")} disabled={!!loading || checking || pro || (!!user && !quota)} className={button + " bg-blue-600 text-white hover:bg-blue-700"} data-testid="pricing-mission-cta">
            {loading === "shiftflow_mission" && <Loader2 size={18} className="animate-spin"/>}{pro ? "Inclus dans votre Pro" : user ? "Acheter 1 mission — 4,90 €" : "Essayer avec 3 missions offertes"}
          </button>}
        </section>
        <section className="flex flex-col rounded-2xl border border-gray-900 bg-gray-900 p-6 text-white" data-testid="pricing-card-pro">
          <p className="text-sm font-semibold text-blue-300">Pour une activité régulière</p><h2 className="mt-2 text-xl font-bold">Pro illimité</h2>
          <p className="mt-5 text-4xl font-bold">49 €<span className="text-base font-normal text-gray-300"> / mois</span></p><p className="mt-2 text-sm text-gray-300">Renouvelé chaque mois · résiliable à tout moment</p>
          <p className="mt-5 flex-1 text-sm leading-relaxed text-gray-200">Créez autant de missions que nécessaire. Au prix de 10 missions à l’unité ; plus économique dès la 11e mission payante du mois.</p>
          <button onClick={() => checkout("shiftflow_pro_monthly")} disabled={!!loading || checking || pro || (!!user && !quota)} className={button + " bg-white text-gray-900 hover:bg-blue-50"} data-testid="pricing-monthly-cta">{loading === "shiftflow_pro_monthly" && <Loader2 size={18} className="animate-spin"/>}{pro ? "Déjà Pro" : "Choisir Pro — 49 €/mois"}</button>
        </section>
      </div>
      <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Les mêmes outils pour réussir chaque mission</h2>
        <ul className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2 lg:grid-cols-4">{features.map(feature => <li key={feature} className="flex items-start gap-2"><Check size={18} className="shrink-0 text-emerald-600"/>{feature}</li>)}</ul>
      </section>
      {!pro && <div ref={consentRef} className={"mt-6 rounded-xl border p-4 " + (consentError ? "border-red-500 bg-red-50" : "border-gray-200 bg-white")}>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={accepted} onChange={e => { setAccepted(e.target.checked); setConsentError(false); }} className="mt-0.5 h-5 w-5 shrink-0" aria-invalid={consentError}/><span>Avant un achat, j’accepte les <Link className="text-blue-700 underline" to="/conditions" target="_blank">conditions de vente</Link>, la <Link className="text-blue-700 underline" to="/confidentialite" target="_blank">politique de confidentialité</Link> et le <Link className="text-blue-700 underline" to="/dpa" target="_blank">DPA</Link>.</span></label>
        {consentError && <p role="alert" className="mt-2 text-sm text-red-700">Acceptez les conditions pour ouvrir le paiement.</p>}
      </div>}
      <section className="mx-auto mt-12 max-w-2xl rounded-2xl bg-blue-50 p-6">
        <h2 className="text-xl font-bold">Quelle formule pour votre rythme ?</h2>
        <label htmlFor="mission-volume" className="mt-4 block text-sm text-gray-700">Missions payantes prévues par mois : <strong>{volume}</strong></label>
        <input id="mission-volume" type="range" min="1" max="30" value={volume} onChange={e => setVolume(Number(e.target.value))} className="mt-4 w-full accent-blue-600"/>
        <div aria-live="polite" className="mt-4 grid grid-cols-2 gap-3 text-sm"><p>À la mission<br/><strong className="text-xl">{money(volume * 4.9)}</strong></p><p>Pro illimité<br/><strong className="text-xl">49 €/mois</strong></p></div>
        <p className="mt-4 text-sm font-medium text-blue-900">{volume < 10 ? "À ce rythme, l’unité vous coûte " + money(49 - volume * 4.9) + " de moins par mois." : volume === 10 ? "Même prix : Pro vous permet de créer davantage de missions sans supplément." : "Pro vous fait économiser " + money(volume * 4.9 - 49) + " par mois à ce rythme."}</p>
        <p className="mt-2 text-xs text-gray-500">Comparaison après vos 3 missions offertes. Aucun abonnement n’est choisi automatiquement.</p>
      </section>
      <section className="mx-auto mt-12 max-w-3xl space-y-3">
        <h2 className="mb-4 text-2xl font-bold">Tout savoir avant de commencer</h2>
        {[
          ["Qu’est-ce qu’une mission ?", "Un événement ou une intervention, avec ses créneaux (montage, démontage…), ses intervenants et son suivi. Un nouvel événement correspond à une nouvelle mission ; plusieurs créneaux du même événement restent inclus."],
          ["Quand une mission est-elle décomptée ?", "À sa création, y compris en cas de duplication. Modifier ses créneaux ou suivre les réponses ne consomme pas de nouvelle mission. Archiver ou annuler ne recrédite pas la mission. La simulation gratuite permet de découvrir le fonctionnement sans consommer de mission."],
          ["Les 3 missions offertes expirent-elles ?", "Non. Elles sont offertes une seule fois par compte, sans carte bancaire ni renouvellement mensuel. Les missions déjà créées sont prises en compte pour les comptes existants, sans facturation rétroactive."],
          ["Que se passe-t-il après les 3 missions ?", "Vos missions existantes, leurs réponses et leurs rappels restent utilisables. Pour en créer une nouvelle, achetez un crédit à 4,90 € ou choisissez Pro à 49 €/mois. Les crédits achetés n’expirent pas."],
          ["Et si j’arrête Pro ?", "Pro reste actif jusqu’à la fin de la période payée. Ensuite, vos missions existantes restent utilisables et vous pouvez acheter les nouvelles à l’unité. Aucun paiement à l’unité n’est prélevé automatiquement."],
        ].map(([question, answer]) => <details key={question} className="rounded-xl border border-gray-200 bg-white p-4"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-3 text-sm leading-relaxed text-gray-600">{answer}</p></details>)}
      </section>
      <p className="mt-8 text-center text-xs text-gray-500">Paiement sécurisé via Stripe. Aucun prélèvement sans votre choix.</p>
    </main>
  </div>;
}

