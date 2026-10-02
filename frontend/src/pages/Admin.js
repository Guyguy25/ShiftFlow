import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowLeft, BarChart3, CalendarDays, CheckCircle2, ChevronRight, Crown,
  Laptop, MessageCircle, Search, Send, Smartphone, Tablet, UserPlus,
  Users, Zap
} from "lucide-react";
import { api } from "../lib/api";
import ShiftFlowLoader from "../components/ShiftFlowLoader";

const pct = (value, total) => total ? Math.round((value / total) * 100) : 0;
const fmtDate = value => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", year: "numeric" }).format(date);
};
const fmtDateTime = value => {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("fr-FR", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
};

function MetricCard({ label, value, helper, icon: Icon }) {
  return <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.13em] text-gray-500">{label}</p>
        <p className="mt-2 text-3xl font-bold tracking-tight text-gray-950">{value}</p>
        {helper && <p className="mt-1 text-xs text-gray-500">{helper}</p>}
      </div>
      <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-700"><Icon className="h-5 w-5" /></span>
    </div>
  </div>;
}

function SignupsChart({ data }) {
  const max = Math.max(1, ...data.map(item => item.count));
  const total = data.reduce((sum, item) => sum + item.count, 0);
  return <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-4">
      <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-blue-700">Acquisition</p><h2 className="mt-1 text-xl font-bold">Inscriptions · 30 jours</h2></div>
      <div className="text-right"><p className="text-2xl font-bold">{total}</p><p className="text-xs text-gray-500">sur la période</p></div>
    </div>
    <div className="mt-6 flex h-48 items-end gap-1 sm:gap-1.5" aria-label="Graphique des inscriptions des 30 derniers jours">
      {data.map((item, index) => <div key={item.date} className="group relative flex h-full min-w-0 flex-1 items-end">
        <div
          className="w-full rounded-t-md bg-blue-500/80 transition-colors group-hover:bg-blue-600"
          style={{ height: item.count ? `${Math.max(8, item.count / max * 100)}%` : "2px" }}
        />
        <div className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-gray-950 px-2 py-1 text-[11px] font-semibold text-white group-hover:block">
          {fmtDate(item.date)} · {item.count}
        </div>
        {(index === 0 || index === data.length - 1 || index === Math.floor(data.length / 2)) && <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-gray-400">{new Date(item.date).toLocaleDateString("fr-FR", { day: "2-digit", month: "2-digit" })}</span>}
      </div>)}
    </div>
    <div className="h-7" />
  </section>;
}

function Funnel({ funnel }) {
  const total = funnel[0]?.count || 0;
  return <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-blue-700">Activation</p><h2 className="mt-1 text-xl font-bold">Funnel utilisateurs</h2></div>
    <div className="mt-5 space-y-4">
      {funnel.map((step, index) => {
        const percent = pct(step.count, total);
        const previous = index ? funnel[index - 1].count : total;
        const stepRate = index ? pct(step.count, previous) : 100;
        return <div key={step.key}>
          <div className="mb-1.5 flex items-center justify-between gap-3 text-sm">
            <span className="font-semibold text-gray-800">{step.label}</span>
            <span className="text-gray-500"><strong className="text-gray-950">{step.count}</strong> · {percent}%{index > 0 ? ` · ${stepRate}% étape→étape` : ""}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${percent}%` }} /></div>
        </div>;
      })}
    </div>
  </section>;
}

function Distribution({ devices, plans, total }) {
  const rows = [
    { key: "mobile", label: "Mobile", value: devices.mobile || 0, icon: Smartphone },
    { key: "desktop", label: "Ordinateur", value: devices.desktop || 0, icon: Laptop },
    { key: "tablet", label: "Tablette", value: devices.tablet || 0, icon: Tablet },
    { key: "unknown", label: "Inconnu / ancien compte", value: devices.unknown || 0, icon: Users },
  ];
  return <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
    <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-blue-700">Audience</p><h2 className="mt-1 text-xl font-bold">Appareils & plans</h2></div>
    <div className="mt-5 space-y-3">
      {rows.map(row => <div key={row.key} className="flex items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gray-50 text-gray-600"><row.icon className="h-4 w-4" /></span>
        <div className="min-w-0 flex-1">
          <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{row.label}</span><span className="font-semibold">{row.value} · {pct(row.value, total)}%</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full bg-blue-500" style={{ width: `${pct(row.value, total)}%` }} /></div>
        </div>
      </div>)}
    </div>
    <div className="mt-6 grid grid-cols-2 gap-3 border-t border-gray-100 pt-5">
      <div className="rounded-xl bg-gray-50 p-4"><p className="text-xs font-semibold text-gray-500">Gratuit</p><p className="mt-1 text-2xl font-bold">{plans.free || 0}</p></div>
      <div className="rounded-xl bg-blue-50 p-4"><p className="text-xs font-semibold text-blue-700">Pro</p><p className="mt-1 text-2xl font-bold text-blue-950">{plans.pro || 0}</p></div>
    </div>
  </section>;
}

function StageDots({ activation }) {
  const stages = [
    ["mission_created", "Mission"],
    ["worker_added", "Équipe"],
    ["whatsapp_connected", "WhatsApp"],
    ["first_cascade_sent", "Invitation"],
    ["subscription_started", "Payant"],
  ];
  return <div className="flex flex-wrap gap-1.5">{stages.map(([key, label]) =>
    <span key={key} title={label} className={`rounded-full px-2 py-1 text-[10px] font-bold ${activation?.[key] ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"}`}>
      {activation?.[key] ? "✓ " : ""}{label}
    </span>
  )}</div>;
}

export default function Admin() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");

  const load = () => {
    setError("");
    api.get("/admin/dashboard").then(({ data }) => setData(data)).catch(err => {
      setError(err.response?.status === 403 ? "Vous n’avez pas accès à cet espace." : "Impossible de charger l’administration.");
    });
  };
  useEffect(() => { load(); }, []);

  const filteredUsers = useMemo(() => {
    if (!data) return [];
    const needle = query.trim().toLowerCase();
    return data.users.filter(user => {
      const matchesQuery = !needle || [user.name, user.agency_name, user.email].some(value => (value || "").toLowerCase().includes(needle));
      const matchesFilter =
        filter === "all" ||
        (filter === "mission" && user.activation?.mission_created) ||
        (filter === "whatsapp" && user.activation?.whatsapp_connected) ||
        (filter === "activated" && user.activation?.first_cascade_sent) ||
        (filter === "pro" && user.plan === "pro");
      return matchesQuery && matchesFilter;
    });
  }, [data, query, filter]);

  if (error) return <div className="min-h-screen bg-gray-50 p-6"><div className="mx-auto max-w-xl rounded-2xl border border-red-200 bg-white p-6"><p className="font-semibold text-red-700">{error}</p><button onClick={load} className="mt-4 text-sm font-semibold text-blue-700 underline">Réessayer</button></div></div>;
  if (!data) return <ShiftFlowLoader fullScreen label="Chargement des données ShiftFlow…" />;

  const m = data.metrics;
  return <div className="min-h-screen bg-[#F7F9FC] text-gray-950">
    <header className="sticky top-0 z-30 border-b border-gray-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
        <div className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white"><Zap className="h-5 w-5" /></span>
          <div><p className="font-bold leading-tight">ShiftFlow Admin</p><p className="text-[11px] font-semibold uppercase tracking-wider text-blue-700">Espace owner</p></div>
        </div>
        <Link to="/app/dashboard" className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-700 hover:bg-gray-50"><ArrowLeft className="h-4 w-4" /> Retour à l’app</Link>
      </div>
    </header>

    <main className="mx-auto max-w-[1500px] px-4 py-7 sm:px-6 lg:px-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-700">Pilotage</p><h1 className="mt-1 text-3xl font-bold tracking-tight sm:text-4xl">Vue d’ensemble</h1><p className="mt-1 text-sm text-gray-500">Activation, acquisition et usage de ShiftFlow en un coup d’œil.</p></div>
        <p className="text-xs text-gray-400">Mis à jour {fmtDateTime(data.generated_at)}</p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        <MetricCard label="Utilisateurs" value={m.users_total} helper={`+${m.signups_7d} sur 7 j`} icon={Users} />
        <MetricCard label="Inscrits 30 j" value={m.signups_30d} icon={CalendarDays} />
        <MetricCard label="Missions" value={m.missions_total} icon={BarChart3} />
        <MetricCard label="Intervenants" value={m.workers_total} icon={UserPlus} />
        <MetricCard label="Activés" value={m.activated_users} helper="1re invitation envoyée" icon={Send} />
        <MetricCard label="Clients Pro" value={m.paid_users} icon={Crown} />
        <MetricCard label="Activation" value={`${pct(m.activated_users, m.users_total)}%`} helper="inscription → invitation" icon={CheckCircle2} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.45fr_1fr]">
        <SignupsChart data={data.signup_series} />
        <Funnel funnel={data.funnel} />
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-[.8fr_1.2fr]">
        <Distribution devices={data.devices} plans={data.plans} total={m.users_total} />
        <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-blue-700">Lecture rapide</p><h2 className="mt-1 text-xl font-bold">Conversions clés</h2></div>
          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {data.funnel.slice(1).map((step, index) => {
              const prev = data.funnel[index]?.count || m.users_total;
              return <div key={step.key} className="rounded-xl border border-gray-100 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-700">{step.label}</p>
                <div className="mt-2 flex items-end justify-between gap-3"><span className="text-2xl font-bold">{step.count}</span><span className="text-xs font-bold text-blue-700">{pct(step.count, prev)}% depuis l’étape précédente</span></div>
              </div>;
            })}
          </div>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="border-b border-gray-100 p-5">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-end">
            <div><p className="text-xs font-bold uppercase tracking-[0.13em] text-blue-700">Utilisateurs</p><h2 className="mt-1 text-xl font-bold">Comptes et progression</h2><p className="mt-1 text-sm text-gray-500">{filteredUsers.length} compte{filteredUsers.length > 1 ? "s" : ""} affiché{filteredUsers.length > 1 ? "s" : ""}</p></div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <label className="relative min-w-[260px]"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" /><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Nom, entreprise ou email…" className="h-11 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100" /></label>
              <select value={filter} onChange={e => setFilter(e.target.value)} className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium">
                <option value="all">Tous</option>
                <option value="mission">Mission créée</option>
                <option value="whatsapp">WhatsApp connecté</option>
                <option value="activated">Invitation envoyée</option>
                <option value="pro">Pro</option>
              </select>
            </div>
          </div>
        </div>

        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full min-w-[1100px] text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500"><tr>
              <th className="px-5 py-3">Utilisateur</th><th className="px-4 py-3">Inscription</th><th className="px-4 py-3">Appareil</th><th className="px-4 py-3">Usage</th><th className="px-4 py-3">Progression</th><th className="px-4 py-3">Source</th><th className="px-4 py-3">Plan</th>
            </tr></thead>
            <tbody className="divide-y divide-gray-100">
              {filteredUsers.map(user => <tr key={user.id} className="hover:bg-gray-50/70">
                <td className="px-5 py-4"><div className="font-semibold text-gray-950">{user.name || "Sans nom"}</div><div className="text-xs text-gray-500">{user.agency_name || "—"} · {user.email}</div>{user.role === "owner" && <span className="mt-1 inline-flex rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-700">OWNER</span>}</td>
                <td className="px-4 py-4"><div>{fmtDate(user.created_at)}</div><div className="mt-1 text-xs text-gray-400">Vu {fmtDateTime(user.last_seen_at)}</div></td>
                <td className="px-4 py-4"><div className="font-medium capitalize">{user.signup_device_type === "desktop" ? "Ordinateur" : user.signup_device_type}</div><div className="mt-1 text-xs text-gray-400">Dernier : {user.last_device_type === "desktop" ? "ordinateur" : user.last_device_type}</div></td>
                <td className="px-4 py-4"><div>{user.missions_count} mission{user.missions_count > 1 ? "s" : ""}</div><div className="mt-1 text-xs text-gray-500">{user.workers_count} intervenant{user.workers_count > 1 ? "s" : ""}</div></td>
                <td className="px-4 py-4"><StageDots activation={user.activation} /></td>
                <td className="px-4 py-4"><div className="font-medium">{user.source?.source || "Direct / inconnu"}</div><div className="mt-1 max-w-[180px] truncate text-xs text-gray-400">{user.source?.campaign || user.source?.content || "—"}</div></td>
                <td className="px-4 py-4"><span className={`rounded-full px-2.5 py-1 text-xs font-bold ${user.plan === "pro" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{user.plan === "pro" ? "PRO" : "FREE"}</span></td>
              </tr>)}
            </tbody>
          </table>
        </div>

        <div className="divide-y divide-gray-100 lg:hidden">
          {filteredUsers.map(user => <article key={user.id} className="p-4">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate font-bold">{user.name || "Sans nom"}</p><p className="truncate text-xs text-gray-500">{user.agency_name || user.email}</p></div><span className={`rounded-full px-2 py-1 text-[10px] font-bold ${user.plan === "pro" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-600"}`}>{user.plan === "pro" ? "PRO" : "FREE"}</span></div>
            <div className="mt-3"><StageDots activation={user.activation} /></div>
            <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-500"><span>{user.missions_count} mission(s)</span><span>{user.workers_count} intervenant(s)</span><span>{user.signup_device_type === "desktop" ? "Ordinateur" : user.signup_device_type}</span><span>{fmtDate(user.created_at)}</span></div>
          </article>)}
        </div>
        {!filteredUsers.length && <div className="p-10 text-center text-sm text-gray-500">Aucun utilisateur ne correspond à ces filtres.</div>}
      </section>
    </main>
  </div>;
}
