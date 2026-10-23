import React, { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, AlertTriangle, CalendarClock, CheckCircle2, Send, TrendingUp, X } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { missionTeamStatus } from "../lib/missionPresentation";

import ActivationHome from "../components/ActivationHome";
import JourneyEmpty from "../components/JourneyEmpty";
import { activationNext } from "../lib/activation";
import ShiftFlowLoader from "../components/ShiftFlowLoader";

function MissionCard({ m }) {
  const team = missionTeamStatus(m);
  const filled = team.needed > 0 && team.missing === 0;
  const missing = team.missing;
  return (
    <Link to={`/app/missions/${m.id}`} data-testid={`dashboard-mission-card-${m.id}`} className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
            {m.first_date}{m.last_date && m.last_date !== m.first_date ? ` → ${m.last_date}` : ""} · {(m.shifts || []).length} créneau(x)
          </div>
          <div className="mt-1 font-display font-bold text-lg truncate">{m.name}</div>
          <div className="text-sm text-gray-500 truncate">{m.location}</div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-md border font-medium shrink-0 ${filled ? "status-confirmed" : missing > 0 ? "status-waiting" : "status-contacted"}`}>
          {team.confirmed}/{team.needed} confirmés
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="font-medium text-blue-700">{missing > 0 && m.status !== "cancelled" ? "Voir et compléter l’équipe →" : "Voir la mission →"}</div>
        {!filled && missing > 0 && m.status !== "cancelled" ? (
          <div className="flex items-center gap-1 text-amber-700"><AlertTriangle className="w-4 h-4"/> {missing} manquant{missing > 1 ? "s" : ""}</div>
        ) : filled ? (
          <div className="flex items-center gap-1 text-green-700"><CheckCircle2 className="w-4 h-4"/>Équipe complète</div>
        ) : null}
      </div>
    </Link>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(null);
  const [whatsappStats, setWhatsappStats] = useState(null);
  const [whatsappStatus, setWhatsappStatus] = useState(null);
  const [quota, setQuota] = useState(null);

  const [error, setError] = useState("");
  const load = useCallback(() => {
    setError("");
    api.get("/dashboard/summary").then((r) => setData(r.data)).catch(() => setError("Impossible de charger votre tableau de bord."));
    api.get("/whatsapp/stats").then((r) => setWhatsappStats(r.data)).catch(() => {});
    api.get("/whatsapp/status").then((r) => setWhatsappStatus(r.data)).catch(() => {});
    api.get("/plan/quota").then((r) => setQuota(r.data)).catch(() => {});
  }, []);

  useEffect(() => { load(); }, [load]);
  if (error) return <div role="alert">{error}<button onClick={load} className="ml-3 underline text-blue-700">Réessayer</button></div>;
  if (!data) return <ShiftFlowLoader label="Chargement de votre espace…" />;
  const connected = !!whatsappStatus?.connected;
  const next = activationNext(data, whatsappStatus, quota);
  const replayGuide = searchParams.get("guide") === "1";

  const closeReplayGuide = () => {
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("guide");
    setSearchParams(nextParams, { replace: true });
  };

  if (next) return <ActivationHome summary={data} whatsapp={whatsappStatus} quota={quota} next={next} />;

  return (
    <div data-testid="dashboard-page">
      {replayGuide && (
        <section data-testid="dashboard-replay-guide" className="mb-5 rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-widest text-blue-700">Vos repères</p>
              <h2 className="mt-1 text-lg font-bold text-blue-950">Retrouvez l’essentiel en quelques secondes</h2>
            </div>
            <button type="button" onClick={closeReplayGuide} aria-label="Fermer les conseils" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-blue-700 hover:bg-blue-100">
              <X size={19} />
            </button>
          </div>
          <div className="mt-4 grid gap-2 text-sm text-blue-950 sm:grid-cols-3">
            <Link to="/app/missions" className="rounded-xl bg-white p-3 font-medium shadow-sm">1. Missions : suivez les demandes et les réponses.</Link>
            <Link to="/app/workers" className="rounded-xl bg-white p-3 font-medium shadow-sm">2. Équipe : gérez vos intervenants et WhatsApp.</Link>
            <Link to="/app/missions/new" className="rounded-xl bg-white p-3 font-medium shadow-sm">3. Créer : préparez une nouvelle mission.</Link>
          </div>
          <p className="mt-3 text-xs text-blue-800">Aucun message ne part sans votre confirmation.</p>
        </section>
      )}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] sm:text-xs uppercase tracking-[0.16em] text-blue-700 font-bold">Tableau de bord</div>
          <h1 className="mt-1.5 text-[28px] leading-tight sm:text-4xl font-display font-bold tracking-tight" data-testid="dashboard-greeting">Bonjour {user?.name?.split(" ")[0]} 👋</h1>
          <p className="text-sm sm:text-base text-gray-500 mt-1 truncate">{user?.agency_name}</p>
        </div>
        {!next && <Link to="/app/missions/new" data-testid="new-mission-btn" className="w-full sm:w-auto inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-xl sm:rounded-md font-semibold sm:font-medium transition-colors shadow-sm">
          <Plus className="w-4 h-4"/> Nouvelle mission
        </Link>}
      </div>

      {!next && (connected ? (
        <div className="mt-5 flex items-center gap-2 text-xs text-green-800" data-testid="whatsapp-status-banner">
          <CheckCircle2 className="h-4 w-4"/> WhatsApp connecté · Invitations prêtes à être envoyées
        </div>
      ) : (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm" data-testid="whatsapp-status-banner">
          <Send className="h-5 w-5 text-amber-700"/><div className="flex-1 text-amber-900"><strong>WhatsApp non connecté.</strong> Connectez-le avant d'envoyer une mission.</div>
          <Link to="/app/workers?add=1" className="rounded-lg border border-amber-200 bg-white px-3 py-2 font-semibold text-amber-900">Connecter</Link>
        </div>
      ))}


      {!next && <div className="mt-5 grid grid-cols-2 gap-3 sm:mt-6 lg:grid-cols-4 sm:gap-4">
        {[
          {label: "Missions à venir", value: data.upcoming.length, icon: CalendarClock, color: "text-blue-600", testid: "kpi-upcoming"},
          {label: "Postes non confirmés", value: data.upcoming.filter(m => m.status !== "cancelled").reduce((n,m) => n + missionTeamStatus(m).missing, 0), icon: AlertTriangle, color: "text-amber-600", testid: "kpi-unfilled"},
          {label: "Réponses en attente", value: data.pending_confirmations ?? "—", icon: Send, color: "text-amber-600", testid: "kpi-pending"},
          {label: "Taux de réponse", value: whatsappStats ? `${whatsappStats.response_rate}%` : "—", icon: TrendingUp, color: "text-blue-600", testid: "kpi-response-rate"}
        ].map(metric => <div key={metric.label} className="rounded-xl border border-gray-200 bg-white p-4 sm:p-5" data-testid={metric.testid}>
          <div className="text-[11px] font-semibold uppercase tracking-wider text-gray-500">{metric.label}</div>
          <div className="mt-2 flex items-center gap-2 text-2xl font-bold tabular-nums sm:text-3xl"><metric.icon className={`h-5 w-5 ${metric.color}`}/>{metric.value}</div>
        </div>)}
      </div>}

      <section className="mt-8 sm:mt-10">
        <div className="flex items-center justify-between mb-3 sm:mb-4"><h2 className="font-display font-bold text-lg sm:text-xl">Missions à suivre</h2><Link to="/app/missions" className="text-sm font-medium text-blue-600 hover:text-blue-700" data-testid="dashboard-see-all">Voir tout →</Link></div>
        {data.upcoming.length === 0 ? <JourneyEmpty /> : <div className={`grid md:grid-cols-2 ${next ? "" : "xl:grid-cols-3"} gap-4`}>{[...data.upcoming].filter(m => m.status !== "cancelled").sort((a,b) => (missionTeamStatus(b).missing > 0 ? 1 : 0) - (missionTeamStatus(a).missing > 0 ? 1 : 0) || (a.first_date || "").localeCompare(b.first_date || "")).map((m) => <MissionCard key={m.id} m={m}/>)}</div>}
      </section>

      {data.ongoing.length > 0 && <section className="mt-10"><h2 className="font-display font-bold text-xl mb-4">Missions en cours</h2><div className={`grid md:grid-cols-2 ${next ? "" : "xl:grid-cols-3"} gap-4`}>{data.ongoing.map((m) => <MissionCard key={m.id} m={m}/>)}</div></section>}
    </div>
  );
}


