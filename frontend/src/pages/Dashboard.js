import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, Users, AlertTriangle, CalendarClock, CheckCircle2, Send, MessageSquare, TrendingUp } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { MISSION_STATUS_LABEL } from "../lib/statusMap";

function MissionCard({ m }) {
  const filled = m.total_confirmed >= m.total_needed && m.total_needed > 0;
  const missing = Math.max(0, m.total_needed - m.total_confirmed);
  return (
    <Link
      to={`/app/missions/${m.id}`}
      data-testid={`dashboard-mission-card-${m.id}`}
      className="block bg-white rounded-xl border border-gray-200 p-5 hover:shadow-[0_12px_40px_rgba(0,0,0,0.06)] hover:-translate-y-0.5 transition-transform"
    >
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
          <div className="flex items-center gap-1 text-amber-700">
            <AlertTriangle className="w-4 h-4"/> {missing} manquant{missing > 1 ? "s" : ""}
          </div>
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
  const [smsStats, setSmsStats] = useState(null);
  const [quota, setQuota] = useState(null);

  useEffect(() => {
    api.get("/dashboard/summary").then((r) => setData(r.data)).catch(() => {});
    api.get("/dashboard/sms-stats").then((r) => setSmsStats(r.data)).catch(() => {});
    api.get("/plan/quota").then((r) => setQuota(r.data)).catch(() => {});
  }, []);

  if (!data) return <div className="text-gray-500" data-testid="dashboard-loading">Chargement…</div>;

  return (
    <div data-testid="dashboard-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Tableau de bord</div>
          <h1 className="mt-2 text-3xl sm:text-4xl font-display font-bold tracking-tight" data-testid="dashboard-greeting">
            Bonjour {user?.name?.split(" ")[0]} 👋
          </h1>
          <p className="text-gray-500 mt-1">{user?.agency_name}</p>
        </div>
        <Link
          to="/app/missions/new"
          data-testid="new-mission-btn"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-5 py-3 rounded-md font-medium transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4"/> Nouvelle mission
        </Link>
      </div>

      {/* SMS status banner */}
      <div className={`mt-6 rounded-xl border p-4 flex items-center gap-3 ${data.twilio_ready ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`} data-testid="sms-status-banner">
        <Send className={`w-5 h-5 ${data.twilio_ready ? "text-green-700" : "text-amber-700"}`}/>
        <div className="text-sm">
          {data.twilio_ready ? (
            <><strong className="text-green-800">SMS actif</strong> — les intervenants reçoivent automatiquement leur lien par SMS.</>
          ) : (
            <><strong className="text-amber-800">Mode démo SMS</strong> — Twilio configuré sans numéro d'envoi. Ajoutez <code className="text-xs bg-white px-1 rounded">TWILIO_PHONE_NUMBER</code> pour activer.</>
          )}
        </div>
      </div>

      {/* Plan / quota banner */}
      {quota && quota.plan === "free" && (
        <div className="mt-4 rounded-xl border border-blue-200 bg-blue-50 p-4 flex flex-col sm:flex-row sm:items-center gap-3" data-testid="plan-quota-banner">
          <div className="flex-1 text-sm">
            <strong className="text-blue-900">Plan gratuit</strong> · Missions actives {quota.active_missions}/{quota.mission_limit} · Intervenants {quota.workers}/{quota.worker_limit}
          </div>
          <Link to="/pricing" data-testid="dashboard-upgrade-link" className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium px-4 py-2 rounded-md whitespace-nowrap">
            Passer au Pro →
          </Link>
        </div>
      )}
      {quota && quota.plan === "pro" && (
        <div className="mt-4 rounded-xl border border-green-200 bg-green-50 p-4 text-sm text-green-900 flex items-center gap-2" data-testid="plan-pro-banner">
          <CheckCircle2 className="w-4 h-4"/> Plan <strong>Pro</strong> actif — missions et intervenants illimités.
        </div>
      )}

      {/* KPIs */}
      <div className="mt-6 grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="kpi-missions-total">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Missions totales</div>
          <div className="mt-2 text-3xl font-display font-bold">{data.missions_total}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="kpi-workers-count">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Intervenants</div>
          <div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><Users className="w-6 h-6 text-blue-600"/> {data.workers_count}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="kpi-pending">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Confirmations en attente</div>
          <div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><AlertTriangle className="w-6 h-6 text-amber-500"/> {data.pending_confirmations}</div>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="kpi-upcoming">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Missions à venir</div>
          <div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><CalendarClock className="w-6 h-6 text-blue-600"/> {data.upcoming.length}</div>
        </div>
      </div>

      {/* SMS stats */}
      {smsStats && (
        <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-4" data-testid="sms-stats-block">
          <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="stat-sent-month">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">SMS ce mois</div>
            <div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><MessageSquare className="w-6 h-6 text-blue-600"/> {smsStats.sent_this_month}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="stat-sms-total">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">SMS envoyés (total)</div>
            <div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><Send className="w-6 h-6 text-green-600"/> {smsStats.sms_total}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="stat-invites">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Invitations contactées</div>
            <div className="mt-2 text-3xl font-display font-bold">{smsStats.invites_responded}/{smsStats.invites_sent}</div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-5" data-testid="stat-response-rate">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Taux de réponse</div>
            <div className="mt-2 text-3xl font-display font-bold flex items-center gap-2"><TrendingUp className="w-6 h-6 text-blue-600"/> {smsStats.response_rate}%</div>
          </div>
        </div>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-display font-bold text-xl">Missions à venir</h2>
          <Link to="/app/missions" className="text-sm text-blue-600 hover:text-blue-700" data-testid="dashboard-see-all">Voir tout →</Link>
        </div>
        {data.upcoming.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500" data-testid="dashboard-empty-upcoming">
            Aucune mission à venir. <Link to="/app/missions/new" className="text-blue-600 font-medium">Créez votre première mission</Link>.
          </div>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.upcoming.map((m) => <MissionCard key={m.id} m={m}/>)}
          </div>
        )}
      </section>

      {data.ongoing.length > 0 && (
        <section className="mt-10">
          <h2 className="font-display font-bold text-xl mb-4">Missions en cours</h2>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.ongoing.map((m) => <MissionCard key={m.id} m={m}/>)}
          </div>
        </section>
      )}
    </div>
  );
}
