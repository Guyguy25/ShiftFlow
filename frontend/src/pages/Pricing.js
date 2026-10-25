import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Check, Minus, Zap, ArrowLeft } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { LEGAL_VERSION } from "../constants/legal";
import WhopCheckoutModal from "../components/WhopCheckoutModal";
import { PLAN_OFFERS } from "../lib/billingConfig";
import { pricingRecommendation } from "../lib/pricingRecommendation";

export const OFFERS = PLAN_OFFERS;
const COMPARISON = [
  ["Missions par mois", "3", "20", "Illimitées"],
  ["Collaborateurs en plus du propriétaire", "Aucun", "3", "10"],
  ["Organisations du propriétaire", "Illimitées", "Illimitées", "Illimitées"],
  ["Intervenants et contacts", "Illimités", "Illimités", "Illimités"],
  ["Invitations et relances WhatsApp", true, true, true],
  ["Remplacement en cascade", true, true, true],
  ["Calendrier et relevés d’heures", true, true, true],
  ["Accès individuels pour les collaborateurs", false, true, true],
  ["Rôles administrateur et coordinateur", false, false, true],
];
const VOLUMES = [["1-3", "Jusqu’à 3 / mois"], ["4-10", "4 à 20 / mois"], ["21+", "Plus de 20 / mois"]];
const euros = value => value.toLocaleString("fr-FR", { minimumFractionDigits: Number.isInteger(value) ? 0 : 2, maximumFractionDigits: 2 });
export default function Pricing() {
  const { user } = useAuth();
  const [quota, setQuota] = useState(null), [config, setConfig] = useState(null);
  const [annual, setAnnual] = useState(false);
  const [selectedVolume, setSelectedVolume] = useState(null);
  useEffect(() => { setSelectedVolume(null); }, [user?.id]);
  const [loading, setLoading] = useState(""), [error, setError] = useState(""), [checkout, setCheckout] = useState(null);
  const inFlight = useRef(false);
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
  const savedRecommendation = user && owner ? pricingRecommendation(user.onboarding_answers) : null;
  const recommendation = selectedVolume ? pricingRecommendation({monthly_missions: selectedVolume}) : savedRecommendation;
  const highlightedOffer = recommendation?.tier || "pro";
  async function portal() {
    if (inFlight.current) return; inFlight.current = true; setLoading("portal"); setError("");
    try { const { data } = await api.post("/payments/portal", {}, { headers }); window.location.assign(data.url); }
    catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { inFlight.current = false; setLoading(""); }
  }
  async function subscribe(offer) {
    if (!user) { window.location.assign("/register"); return; }
    if (!orgId) { window.location.assign("/organizations/new"); return; }
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
    <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-7">
      <div className="text-center"><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Choisissez votre offre ShiftFlow</h1><p className="mt-2 text-sm text-gray-600">3 missions offertes, puis dès 29 €/mois. Un abonnement pour toutes vos organisations.</p></div>
      {orgId && <p className="mt-7 rounded-xl border border-blue-100 bg-blue-50 p-4 text-center text-sm text-blue-900">Espace <strong>{user.organization.name}</strong>. {owner ? "Votre abonnement couvre toutes les organisations dont vous êtes propriétaire." : "Seul son propriétaire peut gérer la facturation. Vous pouvez aussi créer votre propre organisation."}</p>}
      {user?.billing_legacy_multiple && <p role="status" className="mt-5 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">Plusieurs abonnements existants couvrent vos espaces. Leurs accès sont conservés. Contactez le support pour les regrouper ; aucun abonnement n’a été résilié automatiquement.</p>}
      {error && <p role="alert" className="mt-5 rounded-xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}
      {config?.ready === false && !paid && <p role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">Les abonnements Whop sont en cours de configuration. Les achats seront disponibles après activation du paiement sécurisé.</p>}
      {paid && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-4"><p className="text-sm text-emerald-900">Votre offre <strong>{OFFERS.find(o => o.key === quota.subscription_tier)?.name || (quota.subscription_tier === "team" ? "Team (offre historique)" : "Pro (offre historique)")}</strong> est active.</p>{owner && <button onClick={portal} disabled={!!loading} className="min-h-11 rounded-lg bg-white px-4 text-sm font-semibold text-emerald-800">Gérer mon abonnement</button>}</div>}
      <div role="group" aria-label="Fréquence de facturation" className="mx-auto mt-4 grid max-w-sm grid-cols-2 rounded-2xl border bg-white p-1.5 shadow-sm">{[false, true].map(value => <button key={String(value)} aria-pressed={annual === value} disabled={!!loading || !!checkout} onClick={() => setAnnual(value)} className={`min-h-12 rounded-xl px-2 text-sm font-semibold ${annual === value ? "bg-gray-900 text-white" : "text-gray-600"}`}>{value ? "Annuel · jusqu’à −40 %" : "Mensuel"}</button>)}</div>
      <div className="mt-6 grid items-stretch gap-5 md:grid-cols-3">{OFFERS.map(offer => <section id={offer.key} key={offer.key} data-testid={`pricing-card-${offer.key}`} className={`relative flex min-w-0 scroll-mt-8 flex-col rounded-2xl border bg-white p-5 ${offer.key === highlightedOffer ? "border-2 border-blue-600 shadow-sm" : "border-gray-200"}`}>
        {recommendation?.tier === offer.key && <span className="absolute -top-3 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white">Recommandé pour vous</span>}
        <div className="flex flex-wrap items-center gap-2"><h2 className="text-2xl font-bold">{offer.name}</h2>{annual && <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-bold text-emerald-800">−{offer.discount} %</span>}</div>
        {recommendation?.tier === offer.key && <p className="mt-2 text-xs text-blue-700">{selectedVolume ? "Selon votre volume de missions sélectionné." : recommendation.reason}</p>}
        <p className="mt-2 text-4xl font-bold tracking-tight">{euros(annual ? offer.yearly / 12 : offer.monthly)} €<span className="text-sm font-normal tracking-normal text-gray-500"> / mois</span></p>
        <p className="mt-2 min-h-10 text-sm leading-relaxed text-gray-500">{annual ? `${euros(offer.yearly)} € facturés en une fois pour 12 mois. Renouvellement annuel.` : `${offer.monthly} € facturés chaque mois. Sans engagement annuel.`}</p>
        {annual && <p className="mt-2 text-sm font-medium text-emerald-700">{euros(offer.monthly * 12 - offer.yearly)} € économisés par an</p>}
        <button onClick={() => paid ? portal() : subscribe(`${offer.key}_${annual ? "yearly" : "monthly"}`)} disabled={!!loading || !!checkout || !owner || (!paid && (config?.ready !== true || (!!orgId && !quota)))} className={`mt-4 min-h-11 w-full rounded-xl px-3 py-3 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-50 ${offer.key === highlightedOffer ? "bg-blue-600 text-white" : "bg-gray-900 text-white"}`}>{loading ? "Ouverture…" : !owner ? "Géré par le propriétaire" : paid ? (quota.subscription_tier === offer.key ? "Gérer mon offre actuelle" : `Changer vers ${offer.name}`) : `Choisir ${offer.name}`}</button>
        <p className="mt-3 border-t pt-3 text-sm font-semibold">{offer.people}</p><ul className="mt-3 flex-1 space-y-1.5 text-sm text-gray-600">{offer.features.map(feature => <li key={feature} className="flex items-start gap-2"><Check size={18} className="mt-0.5 shrink-0 text-blue-600"/>{feature}</li>)}</ul>

      </section>)}</div>
      <details className="mx-auto mt-4 max-w-2xl rounded-xl border bg-white p-3 text-center"><summary className="cursor-pointer text-sm font-medium text-blue-700">Besoin d’aide pour choisir ? Estimez votre activité</summary>
      <fieldset className="mx-auto mt-3 max-w-2xl rounded-2xl border border-blue-100 bg-blue-50 p-4 text-center sm:p-5">
        <legend className="px-2 text-sm font-semibold text-blue-950">Quelle offre pour votre activité ?</legend>
        <p className="text-sm text-blue-900" role="status">{recommendation ? `${OFFERS.find(o => o.key === recommendation.tier).name} est recommandé pour vous. ${selectedVolume ? "Selon le volume choisi ci-dessous." : recommendation.reason}` : "Choisissez votre volume de missions pour afficher l’offre recommandée pour vous."}</p>
        {!savedRecommendation && !selectedVolume && <p className="mt-2 text-xs text-gray-600">{user ? "Aucun volume personnel exploitable n’est disponible pour cette recommandation." : "Connectez-vous pour retrouver votre recommandation d’inscription, ou estimez votre activité ici."}</p>}
        <div className="mt-3 flex flex-wrap justify-center gap-2">{VOLUMES.map(([value, label]) => <button type="button" key={value} aria-pressed={selectedVolume ? selectedVolume === value : savedRecommendation?.tier === pricingRecommendation({monthly_missions:value}).tier} onClick={() => setSelectedVolume(value)} className={`min-h-11 rounded-xl border px-3 py-2 text-sm font-medium ${((selectedVolume && selectedVolume === value) || (!selectedVolume && savedRecommendation?.tier === pricingRecommendation({monthly_missions:value}).tier)) ? "border-blue-600 bg-blue-600 text-white" : "border-blue-200 bg-white text-blue-900"}`}>{label}</button>)}</div>
        {selectedVolume && savedRecommendation && <button type="button" onClick={() => setSelectedVolume(null)} className="mt-3 min-h-11 text-xs font-medium text-blue-800 underline">Revenir à mes réponses d’inscription</button>}
      </fieldset>
      </details>
      <p className="mt-5 text-center text-xs leading-relaxed text-gray-500">En confirmant votre abonnement dans Whop, vous acceptez les <Link to="/conditions" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">conditions de vente ShiftFlow</Link>. Consultez aussi notre <Link to="/confidentialite" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">politique de confidentialité</Link> et notre <Link to="/dpa" target="_blank" rel="noopener noreferrer" className="text-blue-700 underline">accord sur les données (DPA)</Link>. Aucun engagement n’est pris avant confirmation du paiement.</p>
      {paid && <p className="mt-3 text-center text-xs text-gray-500">Pour modifier votre formule ou votre périodicité, la gestion s’effectue dans le portail de votre prestataire de paiement, sans créer un deuxième abonnement. Si votre changement n’est pas proposé, contactez <a href="mailto:contact@shiftflow.io" className="text-blue-700 underline">le support ShiftFlow</a>.</p>}
      <section aria-labelledby="plan-comparison-title" className="mt-12 sm:mt-16">
        <div className="text-center"><h2 id="plan-comparison-title" className="text-2xl font-bold tracking-tight sm:text-3xl">Comparez les plans en un coup d’œil</h2><p className="mt-3 text-sm text-gray-600">Les mêmes outils pour coordonner vos missions. Des volumes et des accès adaptés à votre équipe.</p></div>
        <p id="comparison-scroll-hint" className="mt-5 text-xs text-gray-500 sm:hidden">Faites défiler le tableau horizontalement pour comparer les trois offres.</p>
        <div role="region" aria-label="Comparatif des offres Start, Pro et Business" tabIndex={0} className="mt-4 overflow-x-auto rounded-2xl border border-gray-200 bg-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600">
          <table className="w-full min-w-[620px] border-collapse text-left text-sm">
            <caption className="sr-only">Fonctionnalités et limites incluses dans chaque abonnement ShiftFlow</caption>
            <thead><tr><th scope="col" className="sticky left-0 z-10 w-[38%] bg-gray-50 p-4 font-semibold sm:p-5">Inclus dans votre offre</th>{OFFERS.map(offer => <th scope="col" key={offer.key} className={`p-4 text-center text-base font-bold sm:p-5 ${offer.key === highlightedOffer ? "bg-blue-50 text-blue-800" : "bg-gray-50"}`}>{offer.name}</th>)}</tr></thead>
            <tbody>{COMPARISON.map(([label, ...values]) => <tr key={label} className="border-t border-gray-100"><th scope="row" className="sticky left-0 z-10 bg-white p-4 font-medium text-gray-700 sm:p-5">{label}</th>{values.map((value, i) => <td key={OFFERS[i].key} className={`p-4 text-center sm:p-5 ${OFFERS[i].key === highlightedOffer ? "bg-blue-50/50" : ""}`}>{typeof value === "boolean" ? <><span className="sr-only">{value ? "Inclus" : "Non inclus"}</span>{value ? <Check aria-hidden="true" size={20} className="mx-auto text-blue-600"/> : <Minus aria-hidden="true" size={20} className="mx-auto text-gray-400"/>}</> : value}</td>)}</tr>)}</tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-gray-500">Les missions et les accès collaborateurs sont partagés entre toutes vos organisations. Les intervenants et contacts ne sont pas des comptes collaborateurs. Une même personne avec un accès ne compte qu’une fois.</p>
      </section>
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
