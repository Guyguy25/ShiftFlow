import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users, AlertTriangle, CalendarClock, CheckCircle2, Send, MessageSquare, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { MISSION_STATUS_LABEL } from "../lib/statusMap";

import { activationNext } from "../lib/activation";

function MissionCard({ m }) {
  const filled = m.total_confirmed >= m.total_needed && m.total_needed > 0;
  const missing = Math.max(0, m.total_needed - m.total_confirmed);
  return (
    <Link to={`/app/missions/${m.id}`} data-testid={`dashboard-mission-card-${m.id}`} className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-transform">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">
            {m.first_date}{m.last_date && m.last_date !== m.first_date ? ` → ${m.last_date}` : ""} · {(m.shifts || []).length} shift{(m.shifts || []).length > 1 ? "s" : ""}
          </div>
          <div className="mt-1 font-display font-bold text-lg truncate">{m.name}</div>
          <div className="text-sm text-gray-500 truncate">{m.location}</div>
        </div>
        <span className={`text-xs px-2 py-1 rounded-md border font-medium shrink-0 ${filled ? "status-confirmed" : missing > 0 ? "status-waiting" : "status-contacted"}`}>
          {m.total_confirmed}/{m.total_needed} confirmés
        </span>
      </div>
      <div className="mt-4 flex items-center justify-between text-sm">
        <div className="text-gray-500">{MISSION_STATUS_LABEL[m.status] || m.status}</div>
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
  if (!data) return <div className="text-gray-500" data-testid="dashboard-loading">Chargement…</div>;
  const connected = !!whatsappStatus?.connected;
  const next = activationNext(data, whatsappStatus, quota);
  const steps = [data.missions_total > 0, data.activation?.active_workers > 0, connected, !!data.activation?.first_invite_sent];

  return (
    <div data-testid="dashboard-page">
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

      {next && <section className="mt-5 rounded-xl border border-blue-200 bg-blue-50 p-5" data-testid="activation-next">
        <h2 className="font-semibold text-lg">Votre première recherche de disponibilités</h2>
        <p className="mt-2 text-sm text-gray-700">{next.description}</p>
        <Link to={next.connect ? "/app/workers?add=1" : next.href} className="mt-4 inline-flex justify-center w-full sm:w-auto px-5 py-3 bg-blue-600 text-white rounded-lg font-semibold">{next.label}</Link>
        <details className="mt-4 text-sm text-gray-700"><summary className="cursor-pointer">Configuration : {steps.filter(Boolean).length}/4</summary>
          <ol className="mt-2 space-y-2">{["Mission créée", "Intervenants ajoutés", "WhatsApp connecté", "Première invitation envoyée"].map((label, i) => <li key={label}>{steps[i] ? "✓" : "○"} {label}</li>)}</ol>
        </details>
      </section>}
      {!next && <div className={`mt-5 rounded-xl border p-4 flex items-start sm:items-center gap-3 ${connected ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`} data-testid="whatsapp-status-banner">
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${connected ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          <Send className="w-4 h-4"/>
        </div>
        <div className="text-sm min-w-0 flex-1">
          {connected ? (
            <><strong className="text-green-900">WhatsApp connecté</strong><span className="hidden sm:inline"> — les invitations et rappels sont envoyés depuis votre session WhatsApp.</span><div className="sm:hidden text-xs text-green-800 mt-0.5">Prêt à envoyer vos missions et relances.</div></>
          ) : (
            <><strong className="text-amber-900">WhatsApp non connecté</strong><div className="text-xs sm:text-sm text-amber-800 mt-0.5">Connectez-le avant d’envoyer une mission.</div></>
          )}
        </div>
        {!connected && <Link to="/app/workers?add=1" className="text-xs font-semibold text-amber-900 bg-white/80 border border-amber-200 rounded-lg px-2.5 py-1.5 shrink-0">Connecter</Link>}
      </div>}

      {!next && quota && quota.plan === "free" && (
        !quota.trial_started ? (
          <div className="hidden sm:flex mt-4 rounded-xl border border-emerald-200 bg-gradient-to-r from-emerald-50 to-white p-4 sm:p-5 flex-col sm:flex-row sm:items-center gap-4" data-testid="plan-quota-banner">
            <div className="flex-1">
              <div className="text-sm font-semibold text-emerald-900">Votre essai gratuit n’a pas encore commencé.</div>
              <div className="mt-1 text-sm text-emerald-800">Il commencera automatiquement lorsque vous créerez votre première mission. Vous pouvez préparer vos intervenants avant.</div>
            </div>
            <Link to="/app/missions/new" data-testid="dashboard-start-trial-link" className="inline-flex items-center justify-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-lg whitespace-nowrap shadow-sm">
              <Plus className="w-4 h-4"/> Créer ma première mission
            </Link>
          </div>
        ) : (
          <div className="hidden sm:flex mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 flex-col sm:flex-row sm:items-center gap-3" data-testid="plan-quota-banner">
            <div className="flex-1 text-sm"><strong className="text-blue-900">Essai gratuit</strong> · Missions utilisées {quota.missions_used}/{quota.mission_limit} · Intervenants {quota.workers}/{quota.worker_limit}</div>
            <Link to="/pricing" data-testid="dashboard-upgrade-link" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md whitespace-nowrap">Passer au Pro →</Link>
          </div>
        )
      )}
      {quota && quota.plan === "pro" && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 flex items-center gap-2" data-testid="plan-pro-banner"><CheckCircle2 className="w-4 h-4"/> Plan <strong>Pro</strong> actif — missions et intervenants illimités.</div>
      )}

      {!next && <><div className="mt-5 sm:mt-6 grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5" data-testid="kpi-missions-total"><div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Missions totales</div><div className="mt-2 text-3xl font-display font-bold">{data.missions_total}</div></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5" data-testid="kpi-workers-count"><div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Intervenants</div><div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><Users className="w-6 h-6 text-blue-600"/> {data.workers_count}</div></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5" data-testid="kpi-pending"><div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Confirmations en attente</div><div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-amber-500"/> {data.pending_confirmations}</div></div>
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5" data-testid="kpi-upcoming"><div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Missions à venir</div><div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><CalendarClock className="w-6 h-6 text-blue-600"/> {data.upcoming.length}</div></div>
      </div>

      {whatsappStats && (
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="whatsapp-stats-block">
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5" data-testid="stat-sent-month"><div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">WhatsApp ce mois</div><div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6 text-blue-600"/> {whatsappStats.sent_this_month}</div></div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5" data-testid="stat-whatsapp-total"><div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Messages envoyés</div><div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><Send className="w-6 h-6 text-green-600"/> {whatsappStats.whatsapp_total}</div></div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5" data-testid="stat-invites"><div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Invitations répondue</div><div className="mt-2 text-3xl font-display font-bold">{whatsappStats.invites_responded}/{whatsappStats.invites_sent}</div></div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-5" data-testid="stat-response-rate"><div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Taux de réponse</div><div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-blue-600"/> {whatsappStats.response_rate}%</div></div>
        </div>
      )}

      </>}
      <section className="mt-8 sm:mt-10">
        <div className="flex items-center justify-between mb-3 sm:mb-4"><h2 className="font-display font-bold text-lg sm:text-xl">Missions à venir</h2><Link to="/app/missions" className="text-sm font-medium text-blue-600 hover:text-blue-700" data-testid="dashboard-see-all">Voir tout →</Link></div>
        {data.upcoming.length === 0 ? <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500" data-testid="dashboard-empty-upcoming">Aucune mission à venir. <Link to="/app/missions/new" className="text-blue-600 font-medium">Créez votre première mission</Link>.</div> : <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{data.upcoming.map((m) => <MissionCard key={m.id} m={m}/>)}</div>}
      </section>

      {data.ongoing.length > 0 && <section className="mt-10"><h2 className="font-display font-bold text-xl mb-4">Missions en cours</h2><div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{data.ongoing.map((m) => <MissionCard key={m.id} m={m}/>)}</div></section>}
    </div>
  );
}
