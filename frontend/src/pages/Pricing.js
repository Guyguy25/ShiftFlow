import { counted } from "../lib/french";
import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, ArrowLeft, Loader2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { LEGAL_VERSION } from "../constants/legal";

import StripeCheckoutModal from "../components/StripeCheckoutModal";

import { YEARLY } from "../lib/billingConfig";
const features = ["Intervenants illimités", "Demandes et rappels WhatsApp", "Cascade automatique", "Suivi des réponses et historique"];
export default function Pricing() {
  const { user } = useAuth();
  const [quota, setQuota] = useState(null);
  const [checking, setChecking] = useState(!!user);
  const [loading, setLoading] = useState(null);
  const [error, setError] = useState("");
  const [embeddedCheckout, setEmbeddedCheckout] = useState(null);
  const checkoutInFlight = useRef(false);
  const [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const consentRef = useRef(null);
  const [annual, setAnnual] = useState(false);
  const [feedbackCode, setFeedbackCode] = useState("");
  useEffect(() => {
    let cancelled = false;
    setFeedbackCode("");
    if (user) api.get("/feedback/status").then(({ data }) => { if (!cancelled) setFeedbackCode(data.promo_code || ""); }).catch(() => {});
    return () => { cancelled = true; };
  }, [user]);
  const teamLookup = annual ? "shiftflow_team_yearly" : "shiftflow_team_monthly";
  const proLookup = annual ? "shiftflow_yearly" : "shiftflow_monthly";
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
  const teamActive = pro && (quota?.subscription_tier || user?.subscription_tier) === "team";
  const billingOwner = user?.can_manage_billing !== false;
  const freeAvailable = !!quota && quota.free_missions_remaining > 0;
  const checkout = async (lookup) => {
    if (!user) { window.location.href = "/register"; return; }
    if (!accepted) {
      setConsentError(true);
      consentRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      consentRef.current?.querySelector("input")?.focus();
      return;
    }
    if (checkoutInFlight.current || embeddedCheckout) return;
    checkoutInFlight.current = true;
    setLoading(lookup); setError("");
    try {
      let publicKey = process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || "";
      if (!publicKey) {
        const { data: config } = await api.get("/payments/config");
        publicKey = config.publishable_key || "";
      }
      const { data } = await api.post("/payments/checkout", {
        ui_mode: publicKey ? "embedded" : "hosted",
        lookup_key: lookup, origin_url: window.location.origin,
        promo_code: lookup === "shiftflow_monthly" ? feedbackCode : "",
        quantity: 1,
        legal_acceptance: { version: LEGAL_VERSION, accepted_at: new Date().toISOString(), scope: "pro_subscription" },
        meta_consent: localStorage.getItem("shiftflow_cookie_consent") === "accepted",
      });
      if (data.ui_mode === "embedded") {
        setEmbeddedCheckout({ ...data, publishable_key: publicKey, lookup_key: lookup });
        setLoading(null);
      } else { window.location.href = data.checkout_url; }
    } catch (err) { setError(formatApiError(err.response?.data?.detail) || "Le paiement n’a pas pu être ouvert."); setLoading(null); }
    finally { checkoutInFlight.current = false; }
  };
  const openPortal = async () => {
    if (loading || !billingOwner) return;
    setLoading("portal"); setError("");
    try { const { data } = await api.post("/payments/portal", {}); window.location.assign(data.url); }
    catch (err) { setError(formatApiError(err.response?.data?.detail)); setLoading(null); }
  };
  const button = "mt-6 flex min-h-12 w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-center font-semibold disabled:opacity-50 disabled:cursor-not-allowed";
  return <div className="min-h-screen bg-[#F9FAFB]">
    <header className="border-b border-gray-100 bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5">
      <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold"><Zap className="text-blue-600"/>ShiftFlow</Link>
      <Link to={user ? "/app/dashboard" : "/"} className="flex min-h-11 items-center gap-2 text-sm text-gray-600"><ArrowLeft size={16}/>Retour</Link>
    </div></header>
    <main className="mx-auto max-w-6xl px-5 py-10 sm:py-16">
      <div className="mx-auto max-w-3xl text-center">
        <p className="text-sm font-semibold text-blue-700">Road, montage et renfort technique événementiel</p>
        <h1 className="mt-3 font-display text-3xl font-bold tracking-tight sm:text-5xl">Vos 3 premières missions sont offertes.</h1>
        <p className="mt-5 text-lg leading-relaxed text-gray-600">Sans date limite ni carte bancaire. Ensuite, ShiftFlow en illimité : 79 €/mois ou {YEARLY.total} €/an, soit {YEARLY.discount} % d’économie avec l’annuel.</p>
      </div>
      {user?.organization && <p className="mt-5 rounded-xl border border-blue-100 bg-blue-50 p-4 text-center text-sm text-blue-900">Offre de <strong>{user.organization.name}</strong>. Chaque organisation conserve ses données et son abonnement.{!billingOwner && " L’abonnement est géré par le propriétaire de cette équipe."}</p>}
      {feedbackCode && !pro && <section className="mt-6 rounded-2xl border border-blue-200 bg-blue-50 p-5"><h2 className="font-bold text-blue-900">Merci pour votre avis : 2 mois de Pro offerts</h2><p className="mt-2 text-sm text-blue-900">Code personnel : <strong className="break-all">{feedbackCode}</strong>. Appliqué automatiquement à Pro mensuel : 0 € pendant deux mois, puis 79 €/mois. Carte requise. Résiliable à tout moment avant la prochaine échéance. Une utilisation par compte.</p></section>}
      {error && <p role="alert" className="mt-6 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">{error}</p>}
      {pro && <p className="mt-6 text-center font-semibold text-emerald-700">Votre abonnement Pro est actif. Vos missions sont illimitées.</p>}
      <div className="mx-auto mt-10 grid max-w-6xl gap-5 md:grid-cols-3">
        <section className="flex flex-col rounded-2xl border border-gray-200 bg-white p-6" data-testid="pricing-card-free">
          <p className="text-sm font-semibold text-emerald-700">Pour découvrir</p><h2 className="mt-2 text-xl font-bold">3 missions offertes</h2>
          <p className="mt-5 text-4xl font-bold">0 €</p><p className="mt-2 text-sm text-gray-500">Une seule fois par compte · valables à vie</p>
          <p className="mt-5 flex-1 text-sm leading-relaxed text-gray-600">Testez ShiftFlow sur vos montages et démontages, avec votre réseau. Aucun passage automatique au payant.</p>
          {user && (checking || !freeAvailable) ? <button type="button" disabled className={button + " border border-gray-200 bg-gray-100 text-gray-500"} data-testid="pricing-free-cta">
            {checking ? "Vérification des missions…" : quota ? counted(quota.free_missions_remaining, "mission offerte restante", "missions offertes restantes") : "Solde indisponible"}
          </button> : <Link to={user ? "/app/missions/new" : "/register"} className={button + " border border-gray-300 bg-white text-gray-900 hover:bg-gray-50"} data-testid="pricing-free-cta">
            {user ? counted(quota.free_missions_remaining, "mission offerte restante", "missions offertes restantes") : "Commencer gratuitement"}
          </Link>}
        </section>
        <section className="flex flex-col rounded-2xl border border-gray-900 bg-gray-900 p-6 text-white" data-testid="pricing-card-pro">
          <p className="text-sm font-semibold text-blue-300">Pour vos équipes de terrain</p><h2 className="mt-2 text-xl font-bold">ShiftFlow Pro</h2>
          <div role="group" aria-label="Fréquence de facturation" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-800 p-1">
            <button aria-pressed={!annual} onClick={() => setAnnual(false)} disabled={!!loading} className={"min-h-11 rounded-lg px-2 text-sm font-semibold " + (!annual ? "bg-white text-gray-900" : "text-gray-200")}>Mensuel</button>
            <button aria-label={`Annuel · −${YEARLY.discount} %`} aria-pressed={annual} onClick={() => setAnnual(true)} disabled={!!loading} className={"flex min-h-11 flex-wrap items-center justify-center gap-2 rounded-lg px-2 py-2 text-sm font-semibold " + (annual ? "bg-white text-gray-900" : "text-white hover:bg-gray-700")}><span>Annuel</span><span className="rounded-full bg-emerald-300 px-2.5 py-1 text-xs font-bold text-emerald-950">−{YEARLY.discount} %</span></button>
          </div>
          <p className="mt-5 text-4xl font-bold">{annual ? `${YEARLY.monthly} €` : "79 €"}<span className="text-base font-normal text-gray-300"> / mois</span></p>
          <p className="mt-2 text-sm text-gray-300">{annual ? `${YEARLY.total} € payés en une fois pour 12 mois, renouvelés chaque année.` : "79 € facturés chaque mois. Sans engagement annuel."}</p>
          <p className="mt-4 flex items-start gap-2 rounded-xl border border-emerald-300/30 bg-emerald-300/10 px-3 py-2.5 text-sm font-medium text-emerald-200"><Check size={18} className="mt-0.5 shrink-0"/><span><strong>{YEARLY.saving} € économisés par an</strong> avec l’annuel, soit {YEARLY.discount} % par rapport à 12 mensualités.</span></p>
          <p className="mt-4 text-sm font-semibold text-blue-200">1 compte dans votre organisation</p>
          <p className="mt-5 flex-1 text-sm leading-relaxed text-gray-200">Montages, démontages et renforts : toutes vos missions et tous vos intervenants, un budget fixe. Sans supplément par personne. Résiliable pour la prochaine échéance, avec accès jusqu’à la fin de la période payée.</p>
          <button onClick={() => checkout(proLookup)} disabled={!!loading || checking || pro || !billingOwner || (!!user && !quota)} className={button + " bg-white text-gray-900 hover:bg-blue-50"} data-testid="pricing-monthly-cta">{loading === proLookup && <Loader2 size={18} className="animate-spin"/>}{pro ? "Déjà Pro" : annual ? `Choisir ShiftFlow — ${YEARLY.total} €/an` : feedbackCode ? "Activer Pro — 2 mois à 0 €" : "Choisir ShiftFlow — 79 €/mois"}</button>
        </section>
        <section id="team" className="flex scroll-mt-8 flex-col rounded-2xl border-2 border-blue-600 bg-white p-6" data-testid="pricing-card-team">
          <p className="text-sm font-semibold text-blue-700">Pour travailler ensemble</p><h2 className="mt-2 text-xl font-bold">ShiftFlow Pro Team</h2>
          <div role="group" aria-label="Fréquence de facturation Pro Team" className="mt-4 grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1">
            <button aria-pressed={!annual} onClick={() => setAnnual(false)} disabled={!!loading} className={"min-h-11 rounded-lg text-sm font-semibold " + (!annual ? "bg-white text-blue-700 shadow-sm" : "text-gray-600")}>Mensuel</button>
            <button aria-label="Annuel Team · −30 %" aria-pressed={annual} onClick={() => setAnnual(true)} disabled={!!loading} className={"min-h-11 rounded-lg text-sm font-semibold " + (annual ? "bg-white text-blue-700 shadow-sm" : "text-gray-600")}>Annuel <span className="ml-1 rounded-full bg-blue-100 px-2 py-1 text-xs text-blue-800">−30 %</span></button>
          </div>
          <p className="mt-5 text-4xl font-bold">{annual ? "62,30 €" : "89 €"}<span className="text-base font-normal text-gray-500"> / mois</span></p>
          <p className="mt-2 text-sm text-gray-500">{annual ? "747,60 € payés en une fois pour 12 mois, renouvelés chaque année." : "89 € facturés chaque mois. Sans engagement annuel."}</p>
          <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-medium text-blue-900">320,40 € économisés par an avec l’annuel, soit 30 %.</p>
          <ul className="mt-5 flex-1 space-y-3 text-sm text-gray-700">{["Toutes les fonctionnalités de Pro", "Missions et intervenants illimités", "Le propriétaire + 5 collaborateurs", "Un compte individuel par personne", "Missions, intervenants et WhatsApp partagés"].map(item => <li key={item} className="flex gap-2"><Check size={18} className="shrink-0 text-blue-600"/>{item}</li>)}</ul>
          <button onClick={() => pro ? openPortal() : checkout(teamLookup)} disabled={!!loading || checking || teamActive || !billingOwner || (!!user && !quota)} className={button + " bg-blue-600 text-white hover:bg-blue-700"} data-testid="pricing-team-cta">{(loading === teamLookup || loading === "portal") && <Loader2 size={18} className="animate-spin"/>}{!billingOwner ? "Géré par le propriétaire" : teamActive ? "Pro Team actif" : pro ? "Passer à Pro Team" : annual ? "Choisir Pro Team — 747,60 €/an" : "Choisir Pro Team — 89 €/mois"}</button>
          {pro && !teamActive && billingOwner && <p className="mt-3 text-xs leading-relaxed text-gray-500">Le changement et son éventuel prorata seront présentés dans le portail Stripe avant confirmation.</p>}
        </section>
      </div>
      <section className="mt-7 rounded-2xl border border-gray-200 bg-white p-5 sm:p-6">
        <h2 className="font-semibold">Les mêmes outils pour réussir chaque mission</h2>
        <ul className="mt-4 grid gap-3 text-sm text-gray-600 sm:grid-cols-2">{features.map(feature => <li key={feature} className="flex items-start gap-2"><Check size={18} className="shrink-0 text-emerald-600"/>{feature}</li>)}</ul>
      </section>
      {!pro && billingOwner && <div ref={consentRef} className={"mt-6 rounded-xl border p-4 " + (consentError ? "border-red-500 bg-red-50" : "border-gray-200 bg-white")}>
        <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-700"><input type="checkbox" checked={accepted} onChange={e => { setAccepted(e.target.checked); setConsentError(false); }} className="mt-0.5 h-5 w-5 shrink-0" aria-invalid={consentError}/><span>Avant un achat, j’accepte les <Link className="text-blue-700 underline" to="/conditions" target="_blank">conditions de vente</Link>, la <Link className="text-blue-700 underline" to="/confidentialite" target="_blank">politique de confidentialité</Link> et le <Link className="text-blue-700 underline" to="/dpa" target="_blank">DPA</Link>.</span></label>
        {consentError && <p role="alert" className="mt-2 text-sm text-red-700">Acceptez les conditions pour ouvrir le paiement.</p>}
      </div>}
      <section className="mx-auto mt-12 max-w-4xl space-y-3">
        <h2 className="mb-4 text-2xl font-bold">Tout savoir avant de commencer</h2>
        {[
          ["Qu’est-ce qu’une mission ?", "Un événement ou une intervention, avec ses créneaux (montage, démontage…), ses intervenants et son suivi. Un nouvel événement correspond à une nouvelle mission ; plusieurs créneaux du même événement restent inclus."],
          ["Quand une mission est-elle décomptée ?", "À sa création, y compris en cas de duplication. Modifier ses créneaux ou suivre les réponses ne consomme pas de nouvelle mission. Archiver ou annuler ne recrédite pas la mission. La simulation gratuite permet de découvrir le fonctionnement sans consommer de mission."],
          ["Les 3 missions offertes expirent-elles ?", "Non. Elles sont offertes une seule fois par compte, sans carte bancaire ni renouvellement mensuel. Les missions déjà créées sont prises en compte pour les comptes existants, sans facturation rétroactive."],
          ["Que se passe-t-il après les 3 missions ?", `Vos missions existantes, leurs réponses et leurs rappels restent utilisables. Pour créer de nouvelles missions, abonnez-vous à ShiftFlow à 79 €/mois ou ${YEARLY.total} €/an, avec des missions illimitées. Aucun passage automatique au payant. Les crédits achetés avant le changement d’offre restent utilisables sans expiration.`],
          ["Et si j’arrête mon abonnement ?", "Votre abonnement mensuel ou annuel reste actif jusqu’à la fin de la période payée. Ensuite, vos missions existantes restent utilisables. Pour en créer de nouvelles après épuisement de vos missions offertes et de vos éventuels anciens crédits, vous devez vous réabonner."],
        ].map(([question, answer]) => <details key={question} className="rounded-xl border border-gray-200 bg-white p-4"><summary className="cursor-pointer font-semibold">{question}</summary><p className="mt-3 text-sm leading-relaxed text-gray-600">{answer}</p></details>)}
      </section>
      <p className="mt-8 text-center text-xs text-gray-500">Paiement sécurisé via Stripe. Chaque abonnement couvre une seule organisation. Pro : propriétaire seul. Pro Team : propriétaire + 5 collaborateurs. Aucun prélèvement sans votre choix.</p>
    </main>
    <StripeCheckoutModal checkout={embeddedCheckout} onClose={() => setEmbeddedCheckout(null)} />
  </div>;
}
