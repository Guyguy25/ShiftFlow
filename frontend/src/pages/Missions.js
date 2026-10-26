import { readPageData, peekPageData } from "../lib/pageData";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, CalendarClock, Copy, Archive, Search } from "lucide-react";
import { api } from "../lib/api";
import { isMissionPast, missionSortDate, missionTeamStatus, missionTimeStatus, todayKey } from "../lib/missionPresentation";
import { toast, Toaster } from "sonner";
import JourneyEmpty from "../components/JourneyEmpty";
import UpgradeModal from "../components/UpgradeModal";
import ShiftFlowLoader from "../components/ShiftFlowLoader";

const control = "w-full h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500";
const period = m => m.first_date ? `${m.first_date}${m.last_date && m.last_date !== m.first_date ? ` → ${m.last_date}` : ""}` : "Date à définir";

function MissionBadge({ mission }) {
  const state = missionTimeStatus(mission);
  return <span className={`inline-flex shrink-0 rounded-lg border px-2 py-1 text-[11px] font-medium ${state.style}`}>{state.label}</span>;
}
function TeamCount({ mission }) {
  const team = missionTeamStatus(mission);
  return <div className="space-y-0.5"><div className="font-semibold text-gray-950 tabular-nums">{team.confirmed}/{team.needed} confirmé(s)</div><div className={`text-xs ${team.missing ? "text-amber-700" : "text-gray-500"}`}>{team.label}</div></div>;
}

export default function Missions() {
  const [missions, setMissions] = useState(() => peekPageData("/missions") ?? []);
  const [loading, setLoading] = useState(() => !peekPageData("/missions"));
  const [loadError, setLoadError] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [order, setOrder] = useState("upcoming");
  const [upgrade, setUpgrade] = useState(null);
  const nav = useNavigate();

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(!peekPageData("/missions", { params: { archived: showArchived } }));
    try {
      const { data } = await readPageData(api, "/missions", { params: { archived: showArchived } });
      setMissions(Array.isArray(data) ? data : []);
      setLoadError("");
    } catch {
      setLoadError("Impossible de charger les missions.");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    load();
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") load({ silent: true });
    };
    const interval = window.setInterval(refreshIfVisible, 15000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [load]);

  const today = todayKey();
  const visible = useMemo(() => {
    const search = query.trim().toLocaleLowerCase("fr");
    return missions.filter(m => {
      if (search && !`${m.name || ""} ${m.location || ""}`.toLocaleLowerCase("fr").includes(search)) return false;
      const team = missionTeamStatus(m);
      const past = isMissionPast(m, today);
      if (filter === "upcoming") return !past && !!m.first_date && m.status !== "cancelled" && m.status !== "draft";
      if (filter === "attention") return !past && m.status !== "cancelled" && m.status !== "draft" && team.missing > 0;
      if (filter === "draft") return m.status === "draft";
      if (filter === "past") return past;
      return true;
    }).sort((a, b) => {
      // Keep undated drafts at the end of chronological sorting.
      const aDate = a.first_date || "", bDate = b.first_date || "";
      if (!aDate || !bDate) return aDate ? -1 : bDate ? 1 : 0;
      if (order === "upcoming") {
        const bucket = m => m.status === "draft" ? 2 : !isMissionPast(m, today) && m.status !== "cancelled" ? 0 : 1;
        const diff = bucket(a) - bucket(b);
        if (diff) return diff;
        return bucket(a) === 0 ? aDate.localeCompare(bDate) : bDate.localeCompare(aDate);
      }
      const result = missionSortDate(a).localeCompare(missionSortDate(b));
      return order === "recent" ? -result : result;
    });
  }, [missions, query, filter, order, today]);

  const duplicate = async (e, id) => {
    e.preventDefault(); e.stopPropagation();
    try {
      const { data } = await api.post(`/missions/${id}/duplicate`);
      toast.success("Mission dupliquée (dates décalées de +7 jours)");
      nav(`/app/missions/${data.id}`);
    } catch (err) {
      const detail = err.response?.data?.detail || "Erreur lors de la duplication";
      if (err.response?.status === 402) setUpgrade(typeof detail === "string" ? detail : "Limite atteinte");
      else toast.error(typeof detail === "string" ? detail : "Erreur lors de la duplication");
    }
  };

  return <div data-testid="missions-page">
    <UpgradeModal open={!!upgrade} onClose={() => setUpgrade(null)} message={upgrade}/>
    <Toaster position="top-right" richColors/>
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <div className="text-[11px] sm:text-xs uppercase tracking-[0.16em] text-blue-700 font-bold">Missions</div>
        <h1 className="mt-1.5 text-[28px] leading-tight sm:text-3xl font-display font-bold tracking-tight">{showArchived ? "Missions archivées" : "Toutes vos missions"}</h1>
        <p className="mt-1 text-sm text-gray-500">Suivez les dates de vos missions et les confirmations de votre équipe.</p>
      </div>
      <div className="grid grid-cols-2 sm:flex gap-2">
        <button type="button" onClick={() => { setShowArchived(v => !v); setFilter("all"); }} className="inline-flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 sm:px-4 py-2.5 rounded-xl sm:rounded-md font-medium">
          <Archive className="w-4 h-4"/> {showArchived ? "Missions actives" : "Archives"}
        </button>
        {!showArchived && <Link to="/app/missions/new" data-testid="missions-new-btn" className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2.5 rounded-xl sm:rounded-md font-medium"><Plus className="w-4 h-4"/> Nouvelle mission</Link>}
      </div>
    </div>

    <div className="mt-6 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
      <label className="relative"><Search className="absolute left-3 top-3.5 w-4 h-4 text-gray-400"/><span className="sr-only">Rechercher une mission</span><input aria-label="Rechercher une mission" value={query} onChange={e => setQuery(e.target.value)} placeholder="Rechercher une mission ou un lieu…" className={control + " pl-9"} type="search"/></label>
      <select aria-label="Filtrer les missions" value={filter} onChange={e => setFilter(e.target.value)} className={control}>
        <option value="all">Toutes les missions</option>
        <option value="upcoming">À venir</option>
        <option value="attention">Équipes à compléter</option>
        <option value="draft">Brouillons</option>
        <option value="past">Dates passées</option>
      </select>
      <select aria-label="Trier les missions" value={order} onChange={e => setOrder(e.target.value)} className={control}><option value="upcoming">À venir en premier</option><option value="recent">Dates récentes d'abord</option><option value="oldest">Dates anciennes d'abord</option></select>
    </div>
    <div className="mt-5">
      {loading ? <ShiftFlowLoader label="Chargement de vos missions…" /> : loadError ? <div role="alert" className="rounded-xl border border-red-100 bg-red-50 p-4 text-sm text-red-700">{loadError}<button type="button" onClick={() => load()} className="ml-3 font-semibold underline">Réessayer</button></div> :
      missions.length === 0 ? <div className={showArchived ? "bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500" : ""}>{showArchived ? "Aucune mission archivée." : <JourneyEmpty />}</div> :
      visible.length === 0 ? <div className="rounded-xl border border-dashed bg-white p-8 text-center text-sm text-gray-600">Aucune mission ne correspond à cette recherche. <button type="button" className="font-semibold text-blue-700" onClick={() => { setFilter("all"); setQuery(""); }}>Effacer les filtres</button></div> : <>
        <p className="mb-3 text-xs text-gray-500">{visible.length} mission{visible.length > 1 ? "s" : ""} affichée{visible.length > 1 ? "s" : ""}</p>
        <div className="space-y-3 sm:hidden">
          {visible.map(m => <div key={m.id} role="link" tabIndex={0} onKeyDown={e => { if (e.key === "Enter") nav(`/app/missions/${m.id}`); }} onClick={() => nav(`/app/missions/${m.id}`)} data-testid={`mission-row-${m.id}`} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm active:bg-gray-50">
            <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate font-semibold text-gray-950">{m.name}</div><div className="mt-1 flex items-center gap-1 text-xs text-gray-500"><CalendarClock className="h-3.5 w-3.5"/> {period(m)}</div><div className="mt-1 text-xs text-gray-500">{m.location}</div></div><MissionBadge mission={m}/></div>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-gray-50 p-3"><TeamCount mission={m}/><span className="text-xs text-gray-500">{(m.shifts || []).length} créneau(x)</span></div>
            {!showArchived && <button onClick={e => duplicate(e, m.id)} data-testid={`duplicate-mission-${m.id}`} className="mt-3 w-full rounded-xl border border-gray-200 py-2.5 text-xs font-medium text-gray-600"><Copy className="mr-1 inline h-3.5 w-3.5"/> Dupliquer</button>}
          </div>)}
        </div>
        <div className="hidden overflow-hidden rounded-xl border border-gray-200 bg-white sm:block">
          <table className="w-full text-sm"><thead className="bg-gray-50 text-left text-xs uppercase tracking-widest text-gray-500"><tr><th className="px-4 py-3">Mission</th><th className="px-4 py-3">Période</th><th className="hidden px-4 py-3 lg:table-cell">Lieu</th><th className="px-4 py-3">Créneaux</th><th className="px-4 py-3">Équipe</th><th className="px-4 py-3">Date / état</th><th className="px-4 py-3"></th></tr></thead>
          <tbody className="divide-y divide-gray-100">{visible.map(m => <tr key={m.id} onClick={() => nav(`/app/missions/${m.id}`)} data-testid={`mission-row-${m.id}`} className="cursor-pointer hover:bg-gray-50"><td className="px-4 py-4 font-medium text-gray-950">{m.name}</td><td className="px-4 py-4 text-gray-600">{period(m)}</td><td className="hidden px-4 py-4 text-gray-600 lg:table-cell">{m.location || "—"}</td><td className="px-4 py-4">{(m.shifts || []).length}</td><td className="px-4 py-4"><TeamCount mission={m}/></td><td className="px-4 py-4"><MissionBadge mission={m}/></td><td className="px-4 py-4 text-right">{!showArchived && <button onClick={e => duplicate(e, m.id)} data-testid={`duplicate-mission-${m.id}`} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600"><Copy className="h-3.5 w-3.5"/> Dupliquer</button>}</td></tr>)}</tbody></table>
        </div>
      </>}
    </div>
  </div>;
}
