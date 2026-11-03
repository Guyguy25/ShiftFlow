import { readPageData, peekPageData } from "../lib/pageData";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Plus, AlertTriangle, CalendarClock, CheckCircle2, X, ArrowRight, MapPin, Clock3, Users, MessageCircle, Send, Bell, XCircle, CalendarDays, Sparkles, Wifi, WifiOff, ChevronRight } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { missionTeamStatus, todayKey } from "../lib/missionPresentation";
import { formatMissionDate } from "../lib/dashboardOverview";
import { liveMissions, dashboardActions, kpis as computeKpis, planningRows, relativeDay, focusDay, nextShift, urgency, enrichedActivity, timeAgo } from "../lib/dashboardInsights";
import { workspacePath } from "../lib/workspacePaths";
import ActivationHome from "../components/ActivationHome";
import { activationNext } from "../lib/activation";
import ShiftFlowLoader from "../components/ShiftFlowLoader";
import "./Dashboard.css";

const card = "rounded-2xl border border-gray-200/80 bg-white shadow-[0_1px_2px_rgba(16,24,40,0.04)]";
const TONES = {
  critical: { dot: "bg-rose-500", chip: "bg-rose-50 text-rose-700 ring-rose-200", bar: "bg-rose-500", icon: "bg-rose-50 text-rose-600", text: "Urgent" },
  soon: { dot: "bg-amber-500", chip: "bg-amber-50 text-amber-800 ring-amber-200", bar: "bg-amber-500", icon: "bg-amber-50 text-amber-600", text: "Cette semaine" },
  later: { dot: "bg-blue-500", chip: "bg-blue-50 text-blue-700 ring-blue-200", bar: "bg-blue-500", icon: "bg-blue-50 text-blue-600", text: "À anticiper" },
  undefined: { dot: "bg-gray-400", chip: "bg-gray-100 text-gray-700 ring-gray-200", bar: "bg-gray-400", icon: "bg-gray-100 text-gray-500", text: "À définir" },
  complete: { dot: "bg-emerald-500", chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", bar: "bg-emerald-500", icon: "bg-emerald-50 text-emerald-600", text: "Complète" },
};
const KIND_ICONS = { invite: Send, followup: Bell, reminder: Bell, cancellation: XCircle };

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

  const today = todayKey();
  const missions = useMemo(() => liveMissions(data, today), [data, today]);
  const actions = useMemo(() => dashboardActions(missions, whatsappStatus?.connected !== false, today), [missions, whatsappStatus, today]);
  const figures = useMemo(() => computeKpis(missions, today), [missions, today]);
  const planning = useMemo(() => planningRows(missions, today, 14), [missions, today]);
  const activity = useMemo(() => enrichedActivity(notifications, data), [notifications, data]);

  if (error) return <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}<button onClick={load} className="ml-3 font-semibold underline">Réessayer</button></div>;
  if (!data) return <ShiftFlowLoader label="Chargement de votre espace…" />;

  const next = activationNext(data, whatsappStatus, quota);
  if (next) return <ActivationHome summary={data} whatsapp={whatsappStatus} quota={quota} next={next} />;

  const connected = whatsappStatus?.connected === true;
  const focus = missions[0];
  const following = missions.slice(1, 4);
  const replayGuide = searchParams.get("guide") === "1";
  const closeReplayGuide = () => {
    const params = new URLSearchParams(searchParams);
    params.delete("guide");
    setSearchParams(params, { replace: true });
  };
  const hour = new Date().getHours();
  const firstName = user?.name?.trim().split(/\s+/)[0];
  const urgent = actions.filter(a => a.type === "mission" && a.level === "critical").length;
  const headline = urgent ? `${urgent} mission${urgent > 1 ? "s" : ""} à compléter en urgence.`
    : actions.length ? `${actions.length} point${actions.length > 1 ? "s" : ""} à traiter dans les 14 prochains jours.`
    : focus ? `Tout est sous contrôle. Prochaine mission : ${relativeDay(focusDay(focus, today), today).toLowerCase()}.`
    : "Aucune mission planifiée pour le moment.";

  const stats = [
    { id: "kpi-upcoming", label: "Missions à venir", value: figures.upcoming, hint: figures.thisWeek ? `dont ${figures.thisWeek} cette semaine` : "Aucune cette semaine", icon: CalendarClock, to: "/app/missions" },
    { id: "kpi-unfilled", label: "Postes à pourvoir", value: figures.missing, hint: figures.missing ? (figures.missingThisWeek ? `dont ${figures.missingThisWeek} sous 7 jours` : "Rien d’urgent cette semaine") : "Toutes les équipes sont complètes", icon: Users, to: "/app/missions", tone: figures.missingThisWeek ? "warn" : figures.missing ? "" : "ok" },
    { id: "kpi-fill-rate", label: "Équipes confirmées", value: figures.fillRate == null ? "—" : `${figures.fillRate}%`, hint: figures.needed ? `${figures.confirmed} sur ${figures.needed} postes` : "Aucun poste prévu", icon: CheckCircle2, progress: figures.fillRate, to: "/app/missions" },
    { id: "kpi-response-rate", label: "Taux de réponse", value: whatsappStats?.response_rate != null ? `${Math.round(whatsappStats.response_rate)}%` : "—", hint: "Invitations WhatsApp", icon: MessageCircle, progress: whatsappStats?.response_rate ?? null, to: "/app/automations" },
  ];

  return <div data-testid="dashboard-page" className="sf-dash space-y-5 sm:space-y-6">
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

    {/* En-tête */}
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-gray-500">
          <span>{new Date().toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }).replace(/^./, c => c.toUpperCase())}</span>
          <span className="text-gray-300">·</span>
          <span className="truncate">{user?.agency_name || user?.organization?.name || "Votre organisation"}</span>
          {whatsappStatus !== null && connected && <span data-testid="whatsapp-status-banner" className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 font-semibold text-emerald-700"><Wifi size={11}/>WhatsApp connecté</span>}
        </p>
        <h1 className="mt-2 font-display text-[28px] font-bold leading-tight tracking-tight text-gray-950 sm:text-[34px]" data-testid="dashboard-greeting">{hour >= 18 ? "Bonsoir" : "Bonjour"}{firstName ? ` ${firstName}` : ""} 👋</h1>
        <p className="mt-1 text-sm text-gray-600" data-testid="dashboard-headline">{headline}</p>
      </div>
      <Link to={scoped("/app/missions/new")} data-testid="new-mission-btn" className="sf-dash-cta inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={17}/> Nouvelle mission</Link>
    </header>

    {whatsappStatus !== null && !connected && <div data-testid="whatsapp-status-banner" className="flex flex-wrap items-center gap-3 rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50 px-4 py-3.5 text-sm text-amber-950">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-amber-600 shadow-sm"><WifiOff size={17}/></span>
      <span className="min-w-0 flex-1"><b className="font-semibold">WhatsApp déconnecté.</b> Reconnectez votre session pour envoyer les invitations.</span>
      <Link className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-amber-600 px-4 text-sm font-semibold text-white hover:bg-amber-700" to={scoped("/app/workers?add=1")}>Connecter <ArrowRight size={15}/></Link>
    </div>}

    {/* Indicateurs */}
    <section aria-label="Indicateurs clés" className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      {stats.map(stat => <Link key={stat.id} to={scoped(stat.to)} data-testid={stat.id} className={`${card} sf-dash-lift group p-4 sm:p-5`}>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs font-medium text-gray-500">{stat.label}</p>
          <span className={`grid h-8 w-8 place-items-center rounded-lg ${stat.tone === "warn" ? "bg-amber-50 text-amber-600" : stat.tone === "ok" ? "bg-emerald-50 text-emerald-600" : "bg-blue-50 text-blue-600"}`}><stat.icon size={16}/></span>
        </div>
        <p className="mt-3 font-display text-[28px] font-bold leading-none tabular-nums text-gray-950 sm:text-3xl">{stat.value}</p>
        {stat.progress != null && <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="sf-dash-bar h-full rounded-full bg-blue-600" style={{ width: `${Math.max(0, Math.min(100, stat.progress))}%` }}/></div>}
        <p className={`mt-2 text-xs ${stat.tone === "warn" ? "font-medium text-amber-700" : stat.tone === "ok" ? "text-emerald-700" : "text-gray-500"}`}>{stat.hint}</p>
      </Link>)}
    </section>

    <div className="grid gap-5 lg:grid-cols-12" data-testid="dashboard-overview">
      {/* Mission à la une */}
      <section className={`${card} min-w-0 overflow-hidden lg:col-span-7`} data-testid="dashboard-next-mission">
        {focus ? <FocusMission mission={focus} today={today} scoped={scoped} following={following}/> : <div className="flex h-full flex-col items-center justify-center p-8 text-center">
          <span className="grid h-14 w-14 place-items-center rounded-2xl bg-blue-50 text-blue-600"><CalendarDays size={26}/></span>
          <h2 className="mt-4 font-display text-xl font-bold text-gray-950">Aucune mission planifiée</h2>
          <p className="mt-1 max-w-xs text-sm text-gray-500">Créez votre prochaine mission : ShiftFlow invite et relance votre équipe à votre place.</p>
          <Link to={scoped("/app/missions/new")} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={16}/>Créer une mission</Link>
        </div>}
      </section>

      {/* À traiter */}
      <section className={`${card} min-w-0 flex flex-col p-5 lg:col-span-5`} data-testid="dashboard-actions">
        <div className="flex items-start justify-between gap-2">
          <div><h2 className="font-display text-lg font-bold text-gray-950">À traiter</h2><p className="mt-0.5 text-xs text-gray-500">Équipes à compléter sous 14 jours, par urgence.</p></div>
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${actions.length ? "bg-amber-50 text-amber-800" : "bg-emerald-50 text-emerald-700"}`}>{actions.length ? `${actions.length} action${actions.length > 1 ? "s" : ""}` : "À jour"}</span>
        </div>
        {actions.length ? <ul className="mt-4 space-y-2">
          {actions.slice(0, 5).map(item => {
            const tone = TONES[item.level] || TONES.later;
            return <li key={item.id}>
              <Link to={scoped(item.to)} className="group flex items-center gap-3 rounded-xl border border-gray-100 p-3 transition hover:border-gray-200 hover:bg-gray-50/70">
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${tone.icon}`}>{item.type === "whatsapp" ? <WifiOff size={17}/> : <AlertTriangle size={17}/>}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2"><span className="truncate text-sm font-semibold text-gray-950">{item.label}</span>{item.day && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset ${tone.chip}`}>{relativeDay(item.day, today)}</span>}</span>
                  <span className="mt-0.5 block truncate text-xs text-gray-500">{item.description}</span>
                  {item.team?.needed > 0 && <span className="mt-2 block h-1 overflow-hidden rounded-full bg-gray-100"><span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${Math.round(100 * item.team.confirmed / item.team.needed)}%` }}/></span>}
                </span>
                <ChevronRight size={17} className="shrink-0 text-gray-300 transition group-hover:translate-x-0.5 group-hover:text-blue-600"/>
              </Link>
            </li>;
          })}
        </ul> : <div className="mt-4 flex flex-1 flex-col items-center justify-center rounded-xl bg-emerald-50/60 p-6 text-center">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-white text-emerald-600 shadow-sm"><CheckCircle2 size={22}/></span>
          <p className="mt-3 text-sm font-semibold text-emerald-950">Aucune action urgente</p>
          <p className="mt-1 text-xs leading-relaxed text-emerald-900/80">Toutes les équipes des 14 prochains jours sont complètes.</p>
        </div>}
        {actions.length > 5 && <p className="mt-2 text-xs text-gray-500">+ {actions.length - 5} autre{actions.length - 5 > 1 ? "s" : ""}</p>}
        <Link to={scoped("/app/missions")} className="mt-auto inline-flex items-center gap-1 pt-4 text-sm font-semibold text-blue-700 hover:text-blue-800">Toutes les missions <ArrowRight size={15}/></Link>
      </section>

      {/* Planning 14 jours */}
      <section className={`${card} min-w-0 p-5 lg:col-span-8`} data-testid="dashboard-planning">
        <div className="flex items-center justify-between gap-3">
          <div><h2 className="font-display text-lg font-bold text-gray-950">Les 14 prochains jours</h2><p className="mt-0.5 text-xs text-gray-500">La couleur indique l’état de chaque équipe.</p></div>
          <Link to={scoped("/app/calendar")} className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800 sm:inline-flex">Calendrier <ArrowRight size={15}/></Link>
        </div>
        <div className="sf-dash-scroll -mx-5 mt-4 overflow-x-auto px-5 pb-1">
          <div className="sf-gantt min-w-[640px]" role="table" aria-label="Missions des 14 prochains jours">
            <div className="sf-gantt-row" role="row">
              <span role="columnheader" className="sr-only">Mission</span>
              {planning.header.map(day => <span key={day.key} role="columnheader" className={`sf-gantt-day ${day.isToday ? "is-today" : ""} ${day.weekend ? "is-weekend" : ""}`}><span className="block text-[10px] font-semibold uppercase tracking-wide">{day.weekday}</span><span className="block font-display text-sm font-bold">{day.day}</span></span>)}
            </div>
            {planning.rows.length ? planning.rows.map(({ mission, active }) => {
              const tone = TONES[urgency(mission, today)] || TONES.later;
              const team = missionTeamStatus(mission);
              return <Link key={mission.id} to={scoped(`/app/missions/${mission.id}`)} role="row" className="sf-gantt-row group" title={`${mission.name} · ${team.label}`}>
                <span role="cell" className="flex min-w-0 items-center gap-2 pr-3"><span className={`h-2 w-2 shrink-0 rounded-full ${tone.dot}`}/><span className="truncate text-sm font-medium text-gray-800 group-hover:text-blue-700">{mission.name}</span><span className="ml-auto shrink-0 text-[11px] tabular-nums text-gray-400">{team.confirmed}/{team.needed}</span></span>
                {active.map((on, i) => <span key={i} role="cell" className={`sf-gantt-cell ${planning.header[i].isToday ? "is-today" : ""} ${planning.header[i].weekend ? "is-weekend" : ""}`}>{on && <span className={`sf-gantt-bar ${tone.bar} ${active[i - 1] ? "join-left" : ""} ${active[i + 1] ? "join-right" : ""}`}/>}</span>)}
              </Link>;
            }) : <p className="py-8 text-center text-sm text-gray-500">Aucune mission sur les 14 prochains jours.</p>}
          </div>
        </div>
        {planning.hidden > 0 && <p className="mt-2 text-xs text-gray-500">+ {planning.hidden} autre{planning.hidden > 1 ? "s" : ""} mission{planning.hidden > 1 ? "s" : ""} sur la période</p>}
        <ul className="mt-4 flex flex-wrap gap-x-4 gap-y-1.5 text-[11px] text-gray-500">
          {["complete", "critical", "soon", "later"].map(level => <li key={level} className="flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${TONES[level].dot}`}/>{level === "complete" ? "Équipe complète" : level === "critical" ? "Incomplète, sous 2 jours" : level === "soon" ? "Incomplète, sous 7 jours" : "Incomplète, plus tard"}</li>)}
        </ul>
      </section>

      {/* Activité */}
      <section className={`${card} min-w-0 p-5 lg:col-span-4`} data-testid="dashboard-activity">
        <div className="flex items-center justify-between gap-3"><div><h2 className="font-display text-lg font-bold text-gray-950">Activité récente</h2><p className="mt-0.5 text-xs text-gray-500">Derniers messages WhatsApp.</p></div></div>
        {activity.length ? <ol className="sf-dash-timeline mt-4">
          {activity.map((event, index) => {
            const Icon = KIND_ICONS[event.kind] || MessageCircle;
            const failed = event.status === "failed";
            return <li key={event.id || index} className="relative flex gap-3 pb-4 last:pb-0">
              <span className={`relative z-10 grid h-8 w-8 shrink-0 place-items-center rounded-full ring-4 ring-white ${failed ? "bg-rose-50 text-rose-600" : "bg-blue-50 text-blue-600"}`}><Icon size={14}/></span>
              <div className="min-w-0 flex-1 pt-0.5">
                <p className="truncate text-sm text-gray-900"><span className="font-semibold">{event.label}</span>{event.missionName && <span className="text-gray-500"> · {event.missionName}</span>}</p>
                <p className="mt-0.5 flex items-center gap-1.5 text-xs text-gray-500">{failed ? <span className="font-semibold text-rose-600">Échec</span> : <span>{event.state}</span>}<span className="text-gray-300">·</span>{timeAgo(event.sent_at) || "Date indisponible"}</p>
              </div>
            </li>;
          })}
        </ol> : <div className="mt-4 rounded-xl bg-gray-50 p-5 text-center text-sm text-gray-500"><Sparkles className="mx-auto mb-2 h-5 w-5 text-gray-300"/>Vos prochains envois apparaîtront ici.</div>}
        <Link to={scoped("/app/automations")} className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-blue-700 hover:text-blue-800">Messages & relances <ArrowRight size={15}/></Link>
      </section>
    </div>
  </div>;
}

const activeShiftCount = mission => (mission.shifts || []).filter(s => s.status !== "cancelled" && !s.deleted_at).length || 1;

function FocusMission({ mission, today, scoped, following }) {
  const team = missionTeamStatus(mission);
  const level = urgency(mission, today);
  const tone = TONES[level] || TONES.later;
  const day = focusDay(mission, today);
  const shift = nextShift(mission, today);
  const started = mission.first_date < today;
  const percent = team.needed ? Math.round((100 * Math.min(team.confirmed, team.needed)) / team.needed) : 0;
  const radius = 34, circumference = 2 * Math.PI * radius;
  return <div className="flex h-full flex-col">
    <div className="relative flex-1 p-5 sm:p-6">
      <div className="sf-dash-glow" aria-hidden="true"/>
      <div className="relative flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-white">{started ? <><span className="sf-dash-live"/>En cours</> : day === today ? <><span className="sf-dash-live"/>Aujourd’hui</> : "Prochaine mission"}</span>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ring-inset ${tone.chip}`}>{team.label}</span>
      </div>
      <div className="relative mt-5 flex items-center gap-5">
        <div className="relative h-[84px] w-[84px] shrink-0" role="img" aria-label={`Équipe confirmée : ${team.confirmed} sur ${team.needed}`}>
          <svg viewBox="0 0 84 84" className="h-full w-full -rotate-90"><circle cx="42" cy="42" r={radius} fill="none" stroke="#eef2f7" strokeWidth="8"/><circle className="sf-dash-ring" cx="42" cy="42" r={radius} fill="none" strokeWidth="8" strokeLinecap="round" stroke={level === "complete" ? "#10b981" : level === "critical" ? "#f43f5e" : level === "soon" ? "#f59e0b" : "#2563eb"} strokeDasharray={circumference} strokeDashoffset={circumference * (1 - percent / 100)}/></svg>
          <div className="absolute inset-0 grid place-items-center text-center"><p className="font-display text-lg font-bold leading-none tabular-nums text-gray-950">{team.confirmed}<span className="text-sm text-gray-400">/{team.needed}</span></p></div>
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold text-blue-700">{relativeDay(day, today)}{relativeDay(day, today) !== formatMissionDate(day) && <span className="font-normal text-gray-500"> · {formatMissionDate(day)}</span>}</p>
          <h2 className="mt-1 line-clamp-2 font-display text-xl font-bold leading-tight tracking-tight text-gray-950 sm:text-2xl">{mission.name}</h2>
          <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm text-gray-500">
            <span className="inline-flex items-center gap-1.5"><MapPin size={14}/>{mission.location || "Lieu non renseigné"}</span>
            {shift?.start_time && <span className="inline-flex items-center gap-1.5"><Clock3 size={14}/>{shift.start_time}{shift.end_time ? ` – ${shift.end_time}` : ""}</span>}
          </p>
        </div>
      </div>
      <dl className="relative mt-6 grid grid-cols-3 gap-2">
        {[["Confirmés", team.confirmed, "text-emerald-700"], ["À pourvoir", team.missing, team.missing ? "text-rose-600" : "text-gray-900"], ["Créneaux", activeShiftCount(mission), "text-gray-900"]].map(([label, value, color]) => <div key={label} className="rounded-xl bg-gray-50 px-3 py-2.5"><dt className="text-[11px] font-medium text-gray-500">{label}</dt><dd className={`mt-0.5 font-display text-xl font-bold tabular-nums ${color}`}>{value}</dd></div>)}
      </dl>
      <div className="relative mt-5 flex flex-wrap gap-2">
        <Link to={scoped(`/app/missions/${mission.id}`)} data-testid={`dashboard-mission-card-${mission.id}`} className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-gray-950 px-4 text-sm font-semibold text-white hover:bg-gray-800">{team.missing > 0 ? "Compléter l’équipe" : "Ouvrir la mission"}<ArrowRight size={15}/></Link>
      </div>
    </div>
    {following.length > 0 && <div className="border-t border-gray-100 bg-gray-50/60 px-5 py-3 sm:px-6">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-gray-400">Ensuite</p>
      <ul className="mt-1 divide-y divide-gray-100">
        {following.map(m => {
          const t = missionTeamStatus(m);
          const nextTone = TONES[urgency(m, today)] || TONES.later;
          return <li key={m.id}><Link to={scoped(`/app/missions/${m.id}`)} className="group flex items-center gap-3 py-2 text-sm">
            <span className={`h-2 w-2 shrink-0 rounded-full ${nextTone.dot}`}/>
            <span className="w-24 shrink-0 text-xs font-medium text-gray-500">{relativeDay(focusDay(m, today), today)}</span>
            <span className="min-w-0 flex-1 truncate font-medium text-gray-900 group-hover:text-blue-700">{m.name}</span>
            <span className="shrink-0 text-xs tabular-nums text-gray-500">{t.confirmed}/{t.needed}</span>
          </Link></li>;
        })}
      </ul>
    </div>}
  </div>;
}
