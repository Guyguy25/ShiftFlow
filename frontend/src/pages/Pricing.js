import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Zap, ArrowLeft } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { LEGAL_VERSION } from "../constants/legal";
import WhopCheckoutModal from "../components/WhopCheckoutModal";

export const OFFERS = [
  { key: "start", name: "Start", monthly: 29, yearly: 278.40, discount: 20, tagline: "L'essentiel pour les petites équipes", people: "3 missions par mois · 1 responsable", features: ["Intervenants et contacts illimités", "Invitations et relances WhatsApp", "Remplacement en cascade", "Calendrier et suivi des confirmations"] },
  { key: "pro", name: "Pro", monthly: 79, yearly: 711, discount: 25, tagline: "Pour les prestataires réguliers", people: "20 missions par mois · Vous + 3 collaborateurs", features: ["Toutes les fonctions de Start", "Missions partagées avec les collaborateurs", "Comptes individuels et gestion des accès", "Pointage des heures et suivi des coûts"] },
  { key: "business", name: "Business", monthly: 149, yearly: 1072.80, discount: 40, tagline: "Pour coordonner plusieurs équipes", people: "Missions illimitées · Vous + 10 collaborateurs", features: ["Toutes les fonctions de Pro", "Administrateurs et coordinateurs", "Gestion avancée des autorisations", "Pilotage multi-organisations"] },
];
const euros = value => value.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
export default function Pricing() {
  const { user } = useAuth();
  const [quota, setQuota] = useState(null), [config, setConfig] = useState(null);
  const [annual, setAnnual] = useState(false), [accepted, setAccepted] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [loading, setLoading] = useState(""), [error, setError] = useState(""), [checkout, setCheckout] = useState(null);
  const inFlight = useRef(false), consent = useRef(null);
  const orgId = user?.organization?.id;
  const headers = { "X-Organization-ID": orgId };
  useEffect(() => {
    let live = true; setQuota(null); setCheckout(null);
    api.get("/whop/config").then(({ data }) => { if (live) setConfig(data); }).catch(() => { if (live) setError("Le service de paiement est indisponible. Réessayez plus tard."); });
    if (orgId) api.get("/plan/quota", { headers: { "X-Organization-ID": orgId } }).then(({ data }) => { if (live) setQuota(data); }).catch(() => { if (live) setError("Impossible de vérifier l’offre de cette organisation. Rechargez la page."); });
    const params = new URLSearchParams(window.location.search);
    if (user && params.get("whop_reference") && params.get("organization_id")) setCheckout({ returning: true, reference: params.get("whop_reference"), organization_id: params.get("organization_id"), payment_id: params.get("payment"), payment_status: params.get("status") });
    return () => { live = false; };
  }, [orgId, user?.id]);
  const paid = quota?.plan === "pro";
  const owner = user?.can_manage_billing !== false;
  async function portal() {
    if (inFlight.current) return; inFlight.current = true; setLoading("portal"); setError("");
    try { const { data } = await api.post("/payments/portal", {}, { headers }); window.location.assign(data.url); }
    catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { inFlight.current = false; setLoading(""); }
  }
  async function subscribe(offer) {
    if (!user) { window.location.assign("/register"); return; }
    if (!orgId) { window.location.assign("/organizations/new"); return; }
    if (!accepted) { setConsentError(true); consent.current?.focus({ preventScroll: true }); consent.current?.closest("label")?.scrollIntoView?.({ block: "center", behavior: "smooth" }); return; }
    if (inFlight.current || checkout || !owner) return;
    inFlight.current = true; setLoading(offer); setError("");
    try {
      let tracking = {};
      try {
        if (localStorage.getItem("shiftflow_cookie_consent") === "accepted") {
          const cookie = name => document.cookie.split("; ").find(v => v.startsWith(name + "="))?.split("=").slice(1).join("=") || "";
          tracking = { meta_consent: true, meta_fbp: cookie("_fbp"), meta_fbc: cookie("_fbc") };
        }
      } catch {}
      const { data } = await api.post("/whop/checkout", { offer_key: offer, legal_version: LEGAL_VERSION, ...tracking }, { headers }); setCheckout({ ...data, organization_id: orgId, organization_name: user.organization.name }); }
    catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { inFlight.current = false; setLoading(""); }
  }
  return <div className="min-h-screen bg-[#F9FAFB] text-gray-900">
    <header className="border-b bg-white"><div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5"><Link to="/" className="flex items-center gap-2 text-lg font-bold"><Zap className="text-blue-600"/>ShiftFlow</Link><Link to={user ? "/app/dashboard" : "/"} className="flex min-h-11 items-center gap-2 text-sm"><ArrowLeft size={16}/>Retour</Link></div></header>
    <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6 sm:py-16">
      <div className="mx-auto max-w-2xl text-center"><p className="text-sm font-semibold text-blue-700">Un abonnement pour toutes vos organisations</p><h1 className="mt-3 text-3xl font-bold tracking-tight sm:text-5xl">Moins de coordination.<br/>Plus de missions réussies.</h1><p className="mt-5 text-gray-600">Commencez avec 3 missions offertes. Choisissez ensuite le nombre de missions et d’accès adapté à votre activité.</p></div>
      {orgId && <p className="mt-7 rounded-xl border border-blue-100 bg-blue-50 p-4 text-center text-sm text-blue-900">Espace <strong>{user.organization.name}</strong>. {owner ? "Votre abonnement couvre toutes les organisations dont vous êtes propriétaire." : "Seul son propriétaire peut gérer la facturation. Vous pouvez aussi créer votre propre organisation."}</p>}
      {user?.billing_legacy_multiple && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Plusieurs abonnements existants couvrent vos espaces. Leurs accès sont conservés. Contactez le support pour les regrouper ; aucun abonnement n’a été résilié automatiquement.</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {config?.ready === false && !paid && <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Les abonnements Whop sont en cours de configuration. Les achats seront disponibles après activation du paiement sécurisé.</p>}
      {paid && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm text-emerald-900">Votre offre <strong>{OFFERS.find(o => o.key === quota.subscription_tier)?.name || (quota.subscription_tier === "team" ? "Team (offre historique)" : "Pro (offre historique)")}</strong> est active.</p>{owner && <button onClick={portal} disabled={!!loading} className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-emerald-800">Gérer mon abonnement</button>}</div>}
      <div role="group" aria-label="Fréquence de facturation" className="mx-auto mt-8 grid max-w-sm grid-cols-2 rounded-2xl border bg-white p-1.5 shadow-sm">{[false, true].map(value => <button key={String(value)} aria-pressed={annual === value} disabled={!!loading || !!checkout} onClick={() => setAnnual(value)} className={`min-h-12 rounded-xl px-2 text-sm font-semibold ${annual === value ? "bg-gray-900 text-white" : "text-gray-600"}`}>{value ? "Annuel · jusqu’à −40 %" : "Mensuel"}</button>)}</div>
      <div className="mt-8 grid items-stretch gap-5 md:grid-cols-3">{OFFERS.map(offer => <section id={offer.key} key={offer.key} data-testid={`pricing-card-${offer.key}`} className={`flex min-w-0 scroll-mt-8 flex-col rounded-2xl border bg-white p-5 sm:p-6 ${offer.key === "pro" ? "border-2 border-blue-600 shadow-sm" : "border-gray-200"}`}>
        <p className="text-sm font-medium text-gray-500">{offer.tagline}</p><div className="mt-3 flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold">{offer.name}</h2>{annual && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">−{offer.discount} %</span>}</div>
        <p className="mt-5 text-4xl font-bold tracking-tight">{euros(annual ? offer.yearly / 12 : offer.monthly)} €<span className="text-sm font-normal tracking-normal text-gray-500"> / mois</span></p>
        <p className="mt-3 min-h-12 text-sm leading-relaxed text-gray-500">{annual ? `${euros(offer.yearly)} € facturés en une fois pour 12 mois. Renouvellement annuel.` : `${offer.monthly} € facturés chaque mois. Sans engagement annuel.`}</p>
        {annual && <p className="mt-2 text-sm font-medium text-emerald-700">{euros(offer.monthly * 12 - offer.yearly)} € économisés par an</p>}
        <p className="mt-5 border-t pt-5 text-sm font-semibold">{offer.people}</p><ul className="mt-5 flex-1 space-y-3 text-sm text-gray-600">{offer.features.map(feature => <li key={feature} className="flex items-start gap-2"><Check size={18} className="mt-0.5 shrink-0 text-blue-600"/>{feature}</li>)}</ul>
        <button onClick={() => subscribe(`${offer.key}_${annual ? "yearly" : "monthly"}`)} disabled={!!loading || !!checkout || paid || !owner || config?.ready !== true || (!!orgId && !quota)} className={`mt-7 min-h-12 rounded-xl px-3 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${offer.key === "pro" ? "bg-blue-600 text-white" : "bg-gray-900 text-white"}`}>{loading.startsWith(offer.key) ? "Ouverture…" : !owner ? "Géré par le propriétaire" : paid ? (quota.subscription_tier === offer.key ? "Votre offre actuelle" : "Gérer depuis votre abonnement") : `Choisir ${offer.name}`}</button>
      </section>)}</div>
      {!paid && owner && <label className={`mt-6 flex scroll-mt-6 cursor-pointer items-start gap-3 rounded-xl border p-4 text-sm transition-colors ${consentError ? "border-red-500 bg-red-50 text-red-800 ring-1 ring-red-500" : "border-gray-200 bg-white text-gray-600"}`}><input ref={consent} type="checkbox" checked={accepted} aria-invalid={consentError} aria-describedby={consentError ? "pricing-consent-error" : undefined} onChange={e => { setAccepted(e.target.checked); setConsentError(false); }} className={`mt-0.5 h-5 w-5 shrink-0 accent-blue-600 ${consentError ? "outline outline-2 outline-offset-2 outline-red-500" : ""}`}/><span>Avant l’achat, j’accepte les <Link to="/conditions" target="_blank" className="text-blue-700 underline">conditions de vente</Link>, la <Link to="/confidentialite" target="_blank" className="text-blue-700 underline">politique de confidentialité</Link> et le <Link to="/dpa" target="_blank" className="text-blue-700 underline">DPA</Link>.{consentError && <span id="pricing-consent-error" role="alert" className="mt-2 block font-semibold text-red-700">Acceptez les conditions pour ouvrir le paiement.</span>}</span></label>}
      <section className="mt-8 flex flex-wrap items-center justify-between gap-4 rounded-2xl border bg-white p-5 sm:p-6"><div><h2 className="font-bold">3 missions offertes, sans carte bancaire</h2><p className="mt-2 max-w-2xl text-sm text-gray-500">Une seule fois par propriétaire, partagées entre ses organisations. Créer un nouvel espace ne réinitialise pas ce quota. Aucun passage automatique au payant.</p></div>{user && orgId && quota && !paid && !quota.free_missions_remaining ? <button disabled className="min-h-11 rounded-xl border bg-gray-50 px-4 text-sm text-gray-500">Missions offertes utilisées</button> : <Link to={user ? orgId ? "/app/missions/new" : "/organizations/new" : "/register"} className="inline-flex min-h-11 items-center rounded-xl border px-4 text-sm font-semibold">{paid ? "Créer une mission" : quota ? `${quota.free_missions_remaining} mission(s) offerte(s) restante(s)` : "Commencer gratuitement"}</Link>}</section>
      <section className="mx-auto mt-10 max-w-3xl space-y-3"><h2 className="mb-4 text-2xl font-bold">Des espaces indépendants, un abonnement commun</h2><p className="text-sm text-gray-600">Les quotas de missions et de collaborateurs sont partagés entre toutes vos organisations. Une mission multi-jours ne compte qu’une seule fois. Le compteur de missions se réinitialise au début de chaque mois calendaire (UTC). Les abonnés historiques conservent leurs droits existants.</p>{[
        ["Puis-je créer plusieurs organisations ?", "Oui. Start, Pro et Business couvrent toutes les organisations dont vous êtes propriétaire, y compris celles que vous créerez ensuite. Chaque espace conserve ses missions, ses contacts et sa connexion WhatsApp. Les quotas de missions et de collaborateurs sont mutualisés. Une même personne ne compte qu’une fois pour les accès."],
        ["Quels droits ont les collaborateurs ?", "Start est destiné à un responsable unique. Avec Pro, trois collaborateurs distincts peuvent travailler sur vos missions. Avec Business, dix collaborateurs sont inclus, avec les rôles administrateur et coordinateur. Seul le propriétaire règle l’abonnement."],
        ["Que se passe-t-il si je résilie ?", "Vous gérez l’annulation dans votre portail de facturation. Vos missions existantes restent conservées. Après la fin de l’abonnement, les accès collaborateurs sont suspendus et créer de nouvelles missions nécessite un solde gratuit, un crédit déjà acquis ou un nouvel abonnement."],
        ["Puis-je changer d’offre ?", "Si vous avez déjà un abonnement, ouvrez son portail depuis les paramètres. Consultez les changements disponibles, leur montant et leur date d’effet avant confirmation. Un seul abonnement suffit pour toutes vos organisations."],
      ].map(([q,a]) => <details key={q} className="rounded-xl border bg-white p-4"><summary className="cursor-pointer font-semibold">{q}</summary><p className="mt-3 text-sm leading-relaxed text-gray-600">{a}</p></details>)}</section>
      <p className="mt-8 text-center text-xs leading-relaxed text-gray-500">Paiement sécurisé par Whop. Tarifs en euros ; les éventuelles taxes sont indiquées au paiement. Les abonnements Stripe existants restent gérables dans leur portail.</p>
    </main><WhopCheckoutModal checkout={checkout} onClose={() => { setCheckout(null); if (window.location.search.includes("whop_reference")) window.history.replaceState({}, "", "/pricing"); if (orgId) api.get("/plan/quota", { headers }).then(({ data }) => setQuota(data)).catch(() => {}); }}/>
  </div>;
}
