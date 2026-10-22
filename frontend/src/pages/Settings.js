import OrganizationSettings from "../components/OrganizationSettings";
import { counted } from "../lib/french";
import React, { useEffect, useState } from "react";
import { Crown, ExternalLink, UserRound, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

export default function Settings() {
  const { user } = useAuth();
  const [quota, setQuota] = useState(null);
  const [portalLoading, setPortalLoading] = useState(false);

  useEffect(() => {
    api.get("/plan/quota").then(({ data }) => setQuota(data)).catch(() => {});
  }, []);

  const openPortal = async () => {
    setPortalLoading(true);
    try {
      const { data } = await api.post("/payments/portal", {});
      window.location.href = data.url;
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Impossible d'ouvrir le portail");
      setPortalLoading(false);
    }
  };

  const isPro = user?.plan === "pro";

  return (
    <div data-testid="settings-page">
      <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Organisation</div>
      <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Paramètres</h1>
      <p className="mt-2 text-sm text-gray-500">Gérez votre organisation, ses membres et son abonnement.</p>
      <div className="mt-8 grid gap-6 max-w-3xl">
        <OrganizationSettings />
        <div className={`rounded-xl border p-6 ${isPro ? "bg-gradient-to-br from-blue-600 to-blue-700 text-white border-blue-700" : "bg-white border-gray-200"}`} data-testid="settings-subscription-block">
          <div className="flex items-center gap-2 font-semibold">
            <Crown className="w-5 h-5"/> Abonnement
            <span className={`ml-auto text-xs px-2 py-1 rounded-md font-bold ${isPro ? "bg-white text-blue-700" : "bg-gray-100 text-gray-700"}`} data-testid="settings-plan-badge">
              {isPro ? (user?.subscription_tier === "team" ? "PRO TEAM ACTIF" : "PRO ACTIF") : "À LA MISSION"}
            </span>
          </div>
          {quota && (
            <div className={`mt-3 text-sm ${isPro ? "text-blue-100" : "text-gray-700"}`}>
              {isPro ? (
                <>Missions et intervenants <strong>illimités</strong>. Merci pour votre soutien !</>
              ) : (
                <>{counted(quota.free_missions_remaining, "mission offerte restante", "missions offertes restantes")} · {counted(quota.mission_credits, "mission achetée", "missions achetées")} · <strong>valables à vie</strong>. Vos missions existantes restent utilisables.</>
              )}
            </div>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            {isPro ? (
              <button onClick={openPortal} disabled={portalLoading || user?.can_manage_billing === false} data-testid="settings-portal-btn"
                className="inline-flex items-center gap-2 bg-white text-blue-700 hover:bg-gray-100 px-4 py-2 rounded-md text-sm font-medium disabled:opacity-60">
                <ExternalLink className="w-4 h-4"/>{portalLoading ? "Ouverture…" : (user?.can_manage_billing === false ? "Géré par le propriétaire" : "Gérer mon abonnement")}
              </button>
            ) : (
              <Link to="/pricing" data-testid="settings-upgrade-link"
                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md text-sm font-medium">
                <Crown className="w-4 h-4"/> Acheter une mission ou choisir Pro
              </Link>
            )}
          </div>
        </div>


        <div className="rounded-xl border border-gray-200 bg-white p-6" data-testid="settings-profile-block">
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
        </div>
      </div>
    </div>
  );
}
