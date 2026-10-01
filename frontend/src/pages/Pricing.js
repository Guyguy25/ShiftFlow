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
  const [quantity, setQuantity] = useState(5);
  const [annual, setAnnual] = useState(false);
  const bonus = Math.floor(quantity / 5);
  const credits = quantity + bonus;
  const proLookup = annual ? "shiftflow_pro_yearly" : "shiftflow_pro_monthly";
  // Minimum paid credits needed, including one bonus for every five purchased.
  const paidForVolume = Math.ceil(volume * 5 / 6);
  const missionCost = paidForVolume * 4.9;
  const proEquivalent = annual ? 41.65 : 49;
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
        quantity: lookup === "shiftflow_mission" ? quantity : 1,
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
        <p className="text-sm font-semibold text-blue-700">Moins de relances. Une équipe prête pour chaque mission.</p>
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
          <p className="mt-5 text-sm leading-relaxed text-gray-600">Achetez en une fois, utilisez à votre rythme. Vos crédits n’expirent pas et le suivi reste accessible.</p>
          <div className="mt-4 rounded-xl bg-blue-50 p-4">
            <p className="font-semibold text-blue-900">5 achetées = 1 offerte</p>
            <p className="mt-1 text-xs text-blue-800">Une mission offerte par tranche de 5 achetées dans le même paiement.</p>
            <label htmlFor="mission-quantity" className="mt-3 block text-sm font-medium">Missions à acheter</label>
            <select id="mission-quantity" value={quantity} onChange={e => setQuantity(Number(e.target.value))} className="mt-2 min-h-11 w-full rounded-lg border border-blue-200 bg-white px-3" disabled={!!loading}>
              {Array.from({ length: 100 }, (_, i) => i + 1).map(n => <option key={n} value={n}>{n} achetée{n > 1 ? "s" : ""}{n >= 5 ? ` + ${Math.floor(n / 5)} offerte${n >= 10 ? "s" : ""}` : ""}</option>)}
            </select>
            <div aria-live="polite" className="mt-3 text-sm"><strong>{credits} mission{credits > 1 ? "s" : ""} pour {money(quantity * 4.9)}</strong><p className="mt-1 text-gray-600">{bonus > 0 ? `${bonus} offerte${bonus > 1 ? "s" : ""} incluse${bonus > 1 ? "s" : ""} · ${money(quantity * 4.9 / credits)} par mission` : "Aucun abonnement"}</p></div>
          </div>
          {available && !pro && <Link to="/app/missions/new" className="mt-4 text-sm font-medium text-blue-700 underline">Utiliser ma mission disponible ({(quota?.free_missions_remaining || 0) + (quota?.mission_credits || 0)} restantes)</Link>}
          <button onClick={() => checkout("shiftflow_mission")} disabled={!!loading || checking || pro || (!!user && !quota)} className={button + " bg-blue-600 text-white hover:bg-blue-700"} data-testid="pricing-mission-cta">
            {loading === "shiftflow_mission" && <Loader2 size={18} className="animate-spin"/>}{pro ? "Inclus dans votre Pro" : user ? `Acheter ${credits} mission${credits > 1 ? "s" : ""} — ${money(quantity * 4.9)}` : "Commencer avec 3 missions offertes"}
          </button>
        </section>
        <section className="flex flex-col rounded-2xl border border-gray-900 bg-gray-900 p-6 text-white" data-testid="pricing-card-pro">
          <p className="text-sm font-semibold text-blue-300">Pour une activité régulière</p><h2 className="mt-2 text-xl font-bold">Pro illimité</h2>
          <div role="group" aria-label="Fréquence de facturation Pro" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-800 p-1">
            <button aria-pressed={!annual} onClick={() => setAnnual(false)} disabled={!!loading} className={"min-h-11 rounded-lg px-2 text-sm font-semibold " + (!annual ? "bg-white text-gray-900" : "text-gray-200")}>Mensuel</button>
            <button aria-pressed={annual} onClick={() => setAnnual(true)} disabled={!!loading} className={"min-h-11 rounded-lg px-2 text-sm font-semibold " + (annual ? "bg-white text-gray-900" : "text-gray-200")}>Annuel · −15 %</button>
          </div>
          <p className="mt-5 text-4xl font-bold">{annual ? "41,65 €" : "49 €"}<span className="text-base font-normal text-gray-300"> / mois</span></p>
          <p className="mt-2 text-sm text-gray-300">{annual ? "499,80 € payés en une fois pour 12 mois, renouvelés chaque année." : "49 € facturés chaque mois. Sans engagement annuel."}</p>
          <p className="mt-2 text-sm text-blue-200">{annual ? "88,20 € économisés par an par rapport au mensuel." : "Choisissez l’annuel pour économiser 15 %."}</p>
          <p className="mt-5 flex-1 text-sm leading-relaxed text-gray-200">Toutes vos missions, toute votre équipe, un budget fixe. Résiliable pour la prochaine échéance, avec accès jusqu’à la fin de la période payée.</p>
          <button onClick={() => checkout(proLookup)} disabled={!!loading || checking || pro || (!!user && !quota)} className={button + " bg-white text-gray-900 hover:bg-blue-50"} data-testid="pricing-monthly-cta">{loading === proLookup && <Loader2 size={18} className="animate-spin"/>}{pro ? "Déjà Pro" : annual ? "Choisir Pro — 499,80 €/an" : "Choisir Pro — 49 €/mois"}</button>
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
        <div aria-live="polite" className="mt-4 grid grid-cols-2 gap-3 text-sm"><p>Achat groupé, bonus inclus<br/><strong className="text-xl">{money(missionCost)}</strong></p><p>Pro {annual ? "annuel" : "mensuel"}<br/><strong className="text-xl">{money(proEquivalent)}/mois</strong></p></div>
        <p className="mt-4 text-sm font-medium text-blue-900">{missionCost < proEquivalent ? "Pour ce besoin, l’achat groupé coûte " + money(proEquivalent - missionCost) + " de moins que le coût mensuel de Pro." : missionCost === proEquivalent ? "Même montant : Pro vous laisse créer davantage de missions pendant le mois." : "Pour ce besoin, Pro représente " + money(missionCost - proEquivalent) + " de moins sur ce mois."}</p>
        <p className="mt-2 text-xs leading-relaxed text-gray-500">{paidForVolume} achetées + {Math.floor(paidForVolume / 5)} offertes dans un même paiement. Après vos 3 missions offertes, hors crédits déjà disponibles. Les crédits inutilisés restent disponibles. {annual ? "Pro annuel : 499,80 € à payer maintenant ; 41,65 € est un équivalent mensuel. Comparez selon votre activité sur 12 mois." : "Pro mensuel : 49 € pour chaque mois souscrit."} Aucun abonnement n’est choisi automatiquement.</p>
      </section>
      <section className="mx-auto mt-12 max-w-3xl space-y-3">
        <h2 className="mb-4 text-2xl font-bold">Tout savoir avant de commencer</h2>
        {[
          ["Qu’est-ce qu’une mission ?", "Un événement ou une intervention, avec ses créneaux (montage, démontage…), ses intervenants et son suivi. Un nouvel événement correspond à une nouvelle mission ; plusieurs créneaux du même événement restent inclus."],
          ["Quand une mission est-elle décomptée ?", "À sa création, y compris en cas de duplication. Modifier ses créneaux ou suivre les réponses ne consomme pas de nouvelle mission. Archiver ou annuler ne recrédite pas la mission. La simulation gratuite permet de découvrir le fonctionnement sans consommer de mission."],
          ["Les 3 missions offertes expirent-elles ?", "Non. Elles sont offertes une seule fois par compte, sans carte bancaire ni renouvellement mensuel. Les missions déjà créées sont prises en compte pour les comptes existants, sans facturation rétroactive."],
          ["Que se passe-t-il après les 3 missions ?", "Vos missions existantes, leurs réponses et leurs rappels restent utilisables. Achetez de 1 à 100 missions en un seul paiement à 4,90 € chacune : chaque tranche de 5 achetées ajoute 1 offerte (5 + 1 = 24,50 €, 10 + 2 = 49 €). Le bonus se calcule par commande, pas en cumulant plusieurs commandes. Tous ces crédits n’expirent pas. Vous pouvez aussi choisir Pro mensuel ou annuel."],
          ["Et si j’arrête Pro ?", "Pro reste actif jusqu’à la fin de la période payée. Ensuite, vos missions existantes restent utilisables et vous pouvez acheter les nouvelles à l’unité. Aucun paiement à l’unité n’est prélevé automatiquement."],
        ].map(([question, answer]) => <details key={question} className="rounded-xl border border-gray-200 bg-white p-4"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-3 text-sm leading-relaxed text-gray-600">{answer}</p></details>)}
      </section>
      <p className="mt-8 text-center text-xs text-gray-500">Paiement sécurisé via Stripe. Aucun prélèvement sans votre choix.</p>
    </main>
  </div>;
}
