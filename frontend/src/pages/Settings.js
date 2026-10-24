import OrganizationSettings from "../components/OrganizationSettings";
import { counted } from "../lib/french";
import React, { useCallback, useEffect, useState } from "react";
import { Crown, ExternalLink, UserRound, ArrowRight, CalendarClock, RefreshCw } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

function niceDate(raw) {
  if (!raw) return null;
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? null : new Intl.DateTimeFormat("fr-FR", {
    dateStyle: "long", timeZone: "Europe/Paris",
  }).format(date);
}

function tierName(tier) {
  return { start: "START", pro: "PRO", business: "BUSINESS", team: "TEAM HISTORIQUE" }[tier] || "ABONNEMENT";
}

export default function Settings() {
  const { user } = useAuth();
  const orgId = user?.organization?.id;
  const isPaid = user?.plan === "pro";
  const owner = user?.can_manage_billing !== false;
  const [quota, setQuota] = useState(null);
  const [billing, setBilling] = useState(null);
  const [billingError, setBillingError] = useState("");
  const [billingLoading, setBillingLoading] = useState(false);
  const [portalLoading, setPortalLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const loadBilling = useCallback(async () => {
    if (!isPaid || !owner) return;
    setBillingLoading(true);
    setBillingError("");
    try {
      const { data } = await api.get("/payments/subscription", {
        headers: orgId ? { "X-Organization-ID": orgId } : {},
      });
      setBilling(data);
    } catch (err) {
      setBilling(null);
      setBillingError(formatApiError(err.response?.data?.detail) || "Dates de facturation indisponibles. Réessayez ou ouvrez votre portail de paiement.");
    } finally {
      setBillingLoading(false);
    }
  }, [isPaid, owner, orgId]);

  useEffect(() => {
    let live = true;
    setQuota(null);
    api.get("/plan/quota").then(({ data }) => { if (live) setQuota(data); }).catch(() => {});
    return () => { live = false; };
  }, [orgId]);
  useEffect(() => { loadBilling(); }, [loadBilling]);

  const openPortal = async () => {
    if (portalLoading) return;
    setPortalLoading(true);
    try {
      const { data } = await api.post("/payments/portal", {}, {
        headers: orgId ? { "X-Organization-ID": orgId } : {},
      });
      window.location.assign(data.url);
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Impossible d'ouvrir le portail");
      setPortalLoading(false);
    }
  };

  const changeRenewal = async (mode) => {
    if (actionLoading || !owner || billing?.provider !== "whop") return;
    if (mode === "cancel") {
      const end = niceDate(billing.period_end);
      const message = end
        ? `Résilier le renouvellement automatique ? Votre offre restera active jusqu'au ${end}. Vous ne serez plus prélevé après cette échéance.`
        : "Résilier à la fin de la période payée ? Vérifiez votre date d’échéance auprès de Whop.";
      if (!window.confirm(message)) return;
    }
    setActionLoading(mode);
    setBillingError("");
    try {
      const { data } = await api.post(mode === "cancel" ? "/whop/cancel" : "/whop/uncancel", {}, {
        headers: orgId ? { "X-Organization-ID": orgId } : {},
      });
      setBilling(data);
      toast.success(mode === "cancel" ? "Résiliation programmée à la fin de votre période payée." : "Renouvellement réactivé.");
    } catch (err) {
      setBillingError(formatApiError(err.response?.data?.detail) || "Modification non confirmée par Whop. Vérifiez votre abonnement.");
    } finally {
      setActionLoading("");
    }
  };

  const endDate = niceDate(billing?.period_end);
  const ending = billing?.cancel_at_period_end === true;

  return (
    <div data-testid="settings-page">
      <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Organisation</div>
      <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Paramètres</h1>
      <p className="mt-2 text-sm text-gray-500">Gérez votre organisation, ses membres et votre abonnement.</p>
      <div className="mt-8 grid gap-6 max-w-3xl">
        <OrganizationSettings />
        <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6" data-testid="settings-subscription-block">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-gray-950"><Crown className="h-5 w-5 text-blue-700"/> Mon abonnement</h2>
            <span className={`rounded-md px-2 py-1 text-xs font-bold ${isPaid ? "bg-blue-50 text-blue-800" : "bg-gray-100 text-gray-700"}`} data-testid="settings-plan-badge">
              {isPaid ? `${tierName(billing?.tier || user?.subscription_tier)} ${ending ? "· FIN PROGRAMMÉE" : "· ACTIF"}` : "GRATUIT"}
            </span>
          </div>
          <p className="mt-3 text-sm text-gray-600">Une seule offre pour toutes vos organisations. Les places collaborateurs et quotas de missions sont partagés entre elles.</p>
          {quota && <p className="mt-3 text-sm text-gray-700">
            {isPaid ? <>Contacts illimités · {quota.mission_limit == null
              ? <strong>Missions illimitées</strong>
              : <strong>{quota.missions_this_month || 0}/{quota.mission_limit} missions utilisées ce mois-ci</strong>}</>
              : <>{counted(quota.free_missions_remaining, "mission offerte restante", "missions offertes restantes")} · {counted(quota.mission_credits, "mission achetée", "missions achetées")} · valables à vie.</>}
          </p>}
          {isPaid && owner && <div className="mt-5 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-4" data-testid="settings-billing-details">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 text-sm font-semibold text-gray-950"><CalendarClock size={16}/> Facturation et échéance</p>
                {billingLoading && <p role="status" className="mt-2 text-sm text-gray-500">Vérification de votre abonnement…</p>}
                {billing && <>
                  <p className="mt-2 text-sm font-medium text-gray-900">
                    {ending ? "Résiliation programmée" : billing.status === "active" ? "Renouvellement automatique actif" : "État du paiement à vérifier"}
                  </p>
                  <p className="mt-1 text-sm text-gray-600" data-testid="settings-billing-date">
                    {endDate ? `${ending ? "Accès jusqu’au" : "Prochaine échéance : le"} ${endDate}` : "Date d’échéance indisponible chez le prestataire de paiement."}
                  </p>
                  {billing.billing_interval && <p className="mt-1 text-xs text-gray-500">Facturation {billing.billing_interval === "yearly" ? "annuelle" : "mensuelle"}.</p>}
                  {ending && <p className="mt-2 text-xs text-gray-600">Votre offre reste accessible jusqu’à la fin de la période déjà payée. Aucun renouvellement automatique n’est prévu.</p>}
                  {billing.multiple_subscriptions && <p className="mt-2 text-xs text-amber-700">Plusieurs abonnements historiques : contactez le support pour éviter une modification incorrecte.</p>}
                </>}
              </div>
              <button type="button" onClick={loadBilling} disabled={billingLoading || !!actionLoading} aria-label="Actualiser mon abonnement" title="Actualiser" className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 disabled:opacity-50"><RefreshCw size={16}/></button>
            </div>
            {billingError && <p role="alert" className="text-sm text-red-700">{billingError}</p>}
          </div>}
          <div className="mt-5 flex flex-wrap gap-2">
            {isPaid ? <>
              <button type="button" onClick={openPortal} disabled={portalLoading || !owner} data-testid="settings-portal-btn"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
                <ExternalLink size={16}/>{portalLoading ? "Ouverture…" : !owner ? "Géré par le propriétaire" : "Gérer / changer d’offre"}
              </button>
              {owner && <Link to="/pricing" className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-800">Comparer les offres <ArrowRight size={16}/></Link>}
              {owner && billing?.provider === "whop" && billing.can_cancel && !billing.multiple_subscriptions && <button type="button" onClick={() => changeRenewal("cancel")} disabled={!!actionLoading} data-testid="settings-cancel-subscription"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50">
                {actionLoading === "cancel" ? "Résiliation…" : "Résilier à l’échéance"}
              </button>}
              {owner && billing?.provider === "whop" && billing.can_resume && !billing.multiple_subscriptions && <button type="button" onClick={() => changeRenewal("resume")} disabled={!!actionLoading} data-testid="settings-resume-subscription"
                className="inline-flex min-h-11 items-center gap-2 rounded-lg border border-green-200 px-4 py-2 text-sm font-medium text-green-800 hover:bg-green-50 disabled:opacity-50">
                {actionLoading === "resume" ? "Réactivation…" : "Conserver mon abonnement"}
              </button>}
            </> : <Link to="/pricing" data-testid="settings-upgrade-link" className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white"><Crown size={16}/> Voir les offres dès 29 €/mois</Link>}
          </div>
          {isPaid && owner && <p className="mt-3 text-xs text-gray-500">Les changements de formule, les moyens de paiement et les factures se gèrent dans le portail de votre prestataire. Si Whop ne propose pas le changement souhaité, contactez <a href="mailto:contact@shiftflow.io" className="text-blue-700 underline">contact@shiftflow.io</a>. Aucun deuxième abonnement n’est créé ici.</p>}
        </section>
        <section className="rounded-xl border border-gray-200 bg-white p-6" data-testid="settings-profile-block">
          <div className="flex items-start gap-3">
            <UserRound className="mt-0.5 h-5 w-5 shrink-0 text-blue-600" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <h2 className="font-display text-lg font-bold text-gray-900">Informations du compte</h2>
              <p className="mt-1 text-sm text-gray-600">Modifiez vos coordonnées et votre photo de profil personnelle.</p>
              {user?.email && <p className="mt-2 break-all text-sm text-gray-500">{user.email}</p>}
              <Link to="/app/profile" className="mt-4 inline-flex items-center gap-2 rounded-md border border-gray-200 px-4 py-2.5 text-sm font-medium text-blue-700 hover:bg-blue-50">
                Modifier mon profil <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
