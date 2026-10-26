import { readPageData, peekPageData } from "../lib/pageData";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, AlertTriangle, CalendarClock, CheckCircle2, Send, TrendingUp, X, ArrowRight, Clock3, MessageCircle, Users, Activity } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { missionTeamStatus, todayKey } from "../lib/missionPresentation";
import { activeUpcoming, formatMissionDate, notificationLabel, notificationState, recentActivity, upcomingActions } from "../lib/dashboardOverview";
import { workspacePath } from "../lib/workspacePaths";
import ActivationHome from "../components/ActivationHome";
import { activationNext } from "../lib/activation";
import ShiftFlowLoader from "../components/ShiftFlowLoader";

const tile = "rounded-2xl border border-gray-200 bg-white p-4 sm:p-5";

export default function Dashboard() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [data, setData] = useState(() => peekPageData("/dashboard/summary") ?? null);
  const [whatsappStats, setWhatsappStats] = useState(() => peekPageData("/whatsapp/stats") ?? null);
  const [whatsappStatus, setWhatsappStatus] = useState(() => peekPageData("/whatsapp/status") ?? null);
  const [quota, setQuota] = useState(() => peekPageData("/plan/quota") ?? null);
  const [notifications, setNotifications] = useState(() => peekPageData("/notifications/recent") ?? []);
  const [error, setError] = useState("");
  const scoped = path => workspacePath(user?.organization?.id, path);

  const load = useCallback(() => {
    setError("");
    readPageData(api, "/dashboard/summary").then(r => setData(r.data)).catch(() => setError("Impossible de charger votre tableau de bord."));
    readPageData(api, "/whatsapp/stats").then(r => setWhatsappStats(r.data)).catch(() => {});
    readPageData(api, "/whatsapp/status").then(r => setWhatsappStatus(r.data)).catch(() => {});
    readPageData(api, "/plan/quota").then(r => setQuota(r.data)).catch(() => {});
    readPageData(api, "/notifications/recent").then(r => setNotifications(Array.isArray(r.data) ? r.data : [])).catch(() => setNotifications([]));
  }, []);
  useEffect(() => { load(); }, [load]);

  const missions = useMemo(() => activeUpcoming(data?.upcoming).filter(m => m.first_date >= todayKey()), [data]);
  const priority = useMemo(() => upcomingActions(missions, whatsappStatus?.connected !== false), [missions, whatsappStatus]);
  const activity = useMemo(() => recentActivity(notifications), [notifications]);

  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={load} className="ml-3 font-semibold underline">Réessayer</button></div>;
  if (!data) return <ShiftFlowLoader label="Chargement de votre espace…" />;

  const next = activationNext(data, whatsappStatus, quota);
  const connected = whatsappStatus?.connected === true;
  const nextMission = missions[0];
  const missingTotal = missions.reduce((total, mission) => total + missionTeamStatus(mission).missing, 0);
  const replayGuide = searchParams.get("guide") === "1";
  const closeReplayGuide = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("guide");
    setSearchParams(params, { replace: true });
  };

  if (next) return <ActivationHome summary={data} whatsapp={whatsappStatus} quota={quota} next={next} />;

  const stats = [
    { label: "Missions à venir", value: missions.length, description: "Prestations programmées", icon: CalendarClock, color: "text-blue-600", id: "kpi-upcoming" },
    { label: "Postes à pourvoir", value: missingTotal, description: "Sur vos missions à venir", icon: Users, color: "text-amber-600", id: "kpi-unfilled" },
    { label: "Taux de réponse", value: whatsappStats?.response_rate != null ? `${whatsappStats.response_rate}%` : "—", description: "Invitations WhatsApp", icon: TrendingUp, color: "text-blue-600", id: "kpi-response-rate" },
  ];

  return <div data-testid="dashboard-page" className="space-y-6 sm:space-y-7">
    {replayGuide && <section data-testid="dashboard-replay-guide" className="rounded-2xl border border-blue-200 bg-blue-50 p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">Vos repères</p><h2 className="mt-1 text-lg font-bold text-blue-950">Retrouvez l’essentiel en quelques secondes</h2></div>
        <button type="button" onClick={closeReplayGuide} aria-label="Fermer les conseils" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-blue-700 hover:bg-blue-100"><X size={19}/></button>
      </div>
      <div className="mt-4 grid gap-2 text-sm text-blue-950 sm:grid-cols-3">
        <Link to={scoped("/app/missions")} className="rounded-xl bg-white p-3 font-medium shadow-sm">1. Missions : suivez les réponses.</Link>
        <Link to={scoped("/app/workers")} className="rounded-xl bg-white p-3 font-medium shadow-sm">2. Équipe : vos intervenants.</Link>
        <Link to={scoped("/app/missions/new")} className="rounded-xl bg-white p-3 font-medium shadow-sm">3. Créer : préparez une mission.</Link>
      </div>
      <p className="mt-3 text-xs text-blue-800">Vérifiez toujours vos destinataires avant l’envoi initial d’une mission.</p>
    </section>}

    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Tableau de bord</div>
        <h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight sm:text-4xl" data-testid="dashboard-greeting">Bonjour {user?.name?.split(" ")[0] || "à vous"} 👋</h1>
        <p className="mt-1 text-sm text-gray-500">{user?.agency_name || user?.organization?.name || "Votre organisation"} · Voici l’essentiel de votre activité.</p>
      </div>
      <Link to={scoped("/app/missions/new")} data-testid="new-mission-btn" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 sm:w-auto"><Plus size={17}/> Nouvelle mission</Link>
    </div>

    {whatsappStatus !== null && <div data-testid="whatsapp-status-banner" className={connected ? "flex items-center gap-2 text-xs text-green-700" : "flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"}>
      {connected ? <><CheckCircle2 className="h-4 w-4 shrink-0"/> WhatsApp connecté · Envois disponibles</> : <><AlertTriangle size={17}/><span className="flex-1">WhatsApp déconnecté : reconnectez votre session pour envoyer les invitations.</span><Link className="font-semibold underline" to={scoped("/app/workers?add=1")}>Connecter</Link></>}
    </div>}

    <section aria-label="Indicateurs clés" className="grid grid-cols-1 gap-3 sm:grid-cols-3">
      {stats.map(stat => <div key={stat.id} data-testid={stat.id} className={tile}>
        <div className="flex items-start justify-between gap-2"><p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{stat.label}</p><stat.icon className={`h-5 w-5 ${stat.color}`}/></div>
        <p className="mt-2 font-display text-3xl font-bold tabular-nums text-gray-950">{stat.value}</p>
        <p className="mt-1 text-xs text-gray-500">{stat.description}</p>
      </div>)}
    </section>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]" data-testid="dashboard-overview">
      <section className={tile} data-testid="dashboard-actions">
        <div className="flex items-start justify-between gap-2">
          <div><h2 className="font-display text-lg font-bold text-gray-950">À traiter</h2><p className="mt-1 text-xs text-gray-500">Actions immédiates et équipes à compléter sous 14 jours.</p></div>
          <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ${priority.length ? "bg-amber-50 text-amber-800" : "bg-green-50 text-green-800"}`}>{priority.length ? `${priority.length} action${priority.length > 1 ? "s" : ""}` : "À jour"}</span>
        </div>
        {priority.length ? <ul className="mt-4 divide-y divide-gray-100">
          {priority.map((item, index) => <li key={item.id || `item-${index}`} className="py-3 first:pt-0 last:pb-0">
            <Link to={scoped(item.to)} className="group flex items-center gap-3 rounded-lg hover:bg-gray-50">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-700"><AlertTriangle size={17}/></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold text-gray-950">{item.label}</span><span className="mt-0.5 block text-xs text-gray-500">{item.description}</span></span>
              <ArrowRight size={17} className="shrink-0 text-gray-400 group-hover:text-blue-600"/>
            </Link>
          </li>)}
        </ul> : <div className="mt-5 flex items-start gap-3 rounded-xl bg-green-50/70 p-4"><CheckCircle2 size={21} className="shrink-0 text-green-700"/><div><p className="text-sm font-semibold text-green-950">Aucune action urgente</p><p className="mt-1 text-xs leading-relaxed text-green-900">Rien à compléter sur les missions des 14 prochains jours. Vous pouvez préparer vos prochaines prestations.</p></div></div>}
        <Link to={scoped("/app/missions")} className="mt-5 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">Toutes les missions <ArrowRight size={15}/></Link>
      </section>

      <section className={tile} data-testid="dashboard-next-mission">
        <div className="flex items-center justify-between gap-2"><h2 className="font-display text-lg font-bold text-gray-950">Prochaine mission</h2><CalendarClock size={18} className="text-blue-600"/></div>
        {nextMission ? <div className="mt-4">
          <p className="text-xs font-medium uppercase tracking-wider text-gray-500">{formatMissionDate(nextMission.first_date)}</p>
          <h3 className="mt-1 truncate font-display text-xl font-bold text-gray-950">{nextMission.name}</h3>
          <p className="mt-1 text-sm text-gray-500">{nextMission.location || "Lieu non renseigné"}</p>
          <div className="mt-5 rounded-xl border border-gray-100 bg-gray-50 p-3">
            <div className="flex items-center justify-between gap-2 text-sm"><span className="text-gray-600">Équipe confirmée</span><span className="font-semibold tabular-nums text-gray-950">{missionTeamStatus(nextMission).confirmed}/{missionTeamStatus(nextMission).needed}</span></div>
            <div className="mt-2 h-2 overflow-hidden rounded-full bg-gray-200"><div className="h-full rounded-full bg-blue-600" style={{ width: `${missionTeamStatus(nextMission).needed ? Math.min(100, 100 * missionTeamStatus(nextMission).confirmed / missionTeamStatus(nextMission).needed) : 0}%` }}/></div>
            <p className="mt-2 text-xs text-gray-500">{missionTeamStatus(nextMission).label}</p>
          </div>
          <Link to={scoped(`/app/missions/${nextMission.id}`)} data-testid={`dashboard-mission-card-${nextMission.id}`} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">Voir la mission <ArrowRight size={15}/></Link>
        </div> : <div className="mt-4 rounded-xl border border-dashed border-gray-200 p-5 text-center"><Clock3 className="mx-auto h-7 w-7 text-gray-300"/><p className="mt-2 text-sm font-medium text-gray-800">Aucune mission planifiée</p><Link to={scoped("/app/missions/new")} className="mt-2 inline-flex items-center gap-1 text-sm font-semibold text-blue-700">Créer une mission <ArrowRight size={15}/></Link></div>}
      </section>
    </div>

    <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)]">
      <section className={tile} data-testid="dashboard-activity">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-gray-950">Activité récente</h2><p className="mt-1 text-xs text-gray-500">Derniers messages WhatsApp enregistrés.</p></div><Activity size={18} className="text-blue-600"/></div>
        {activity.length ? <ul className="mt-3 divide-y divide-gray-100">{activity.map((event, index) => <li key={event.id || index} className="flex items-center gap-3 py-3 text-sm"><span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${event.status === "failed" ? "bg-red-50 text-red-700" : "bg-blue-50 text-blue-600"}`}><MessageCircle size={16}/></span><span className="min-w-0 flex-1"><span className="block truncate font-medium text-gray-900">{notificationLabel(event)}</span><span className="block truncate text-xs text-gray-500">{event.sent_at && !Number.isNaN(new Date(event.sent_at).getTime()) ? new Date(event.sent_at).toLocaleString("fr-FR") : "Date indisponible"}</span></span><span className={`text-xs font-semibold ${event.status === "failed" ? "text-red-700" : "text-gray-500"}`}>{notificationState(event)}</span></li>)}</ul> : <p className="mt-4 rounded-xl bg-gray-50 p-4 text-sm text-gray-500">Aucun message récent à afficher. Vos prochains envois apparaîtront ici.</p>}
        <Link to={scoped("/app/automations")} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">Messages & relances <ArrowRight size={15}/></Link>
      </section>
      <section className={tile}>
        <h2 className="font-display text-lg font-bold text-gray-950">Accès rapides</h2>
        <p className="mt-1 text-xs text-gray-500">Vos actions les plus fréquentes.</p>
        <div className="mt-4 space-y-2">
          {[
            { to: "/app/missions/new", label: "Créer une mission", description: "Préparer une nouvelle équipe", icon: Plus },
            { to: "/app/workers", label: "Gérer les intervenants", description: "Contacts et compétences", icon: Users },
            { to: "/app/automations", label: "Messages & relances", description: "Personnaliser les messages WhatsApp", icon: Send },
          ].map(action => <Link key={action.to} to={scoped(action.to)} className="group flex items-center gap-3 rounded-xl border border-gray-100 px-3 py-2.5 transition-colors hover:border-blue-200 hover:bg-blue-50/40"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><action.icon size={17}/></span><span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-gray-950">{action.label}</span><span className="block text-xs text-gray-500">{action.description}</span></span><ArrowRight size={16} className="text-gray-400 group-hover:text-blue-600"/></Link>)}
        </div>
      </section>
    </div>
  </div>;
}
