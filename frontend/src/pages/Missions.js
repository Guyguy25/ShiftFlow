import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, CalendarClock, Copy, Archive } from "lucide-react";
import { api } from "../lib/api";
import { MISSION_STATUS_LABEL } from "../lib/statusMap";
import { toast, Toaster } from "sonner";
import UpgradeModal from "../components/UpgradeModal";

export default function Missions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);
  const [upgrade, setUpgrade] = useState(null);
  const nav = useNavigate();

  const load = useCallback(async ({ silent = false } = {}) => {
    if (!silent) setLoading(true);
    try {
      const { data } = await api.get("/missions", {
        params: { archived: showArchived, _ts: Date.now() },
      });
      setMissions(data);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [showArchived]);

  useEffect(() => {
    load();

    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") {
        load({ silent: true }).catch(() => {});
      }
    };

    const interval = window.setInterval(refreshIfVisible, 3000);
    window.addEventListener("focus", refreshIfVisible);
    document.addEventListener("visibilitychange", refreshIfVisible);

    return () => {
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
    };
  }, [load]);

  const duplicate = async (e, id) => {
    e.preventDefault(); e.stopPropagation();
    try {
      const { data } = await api.post(`/missions/${id}/duplicate`);
      toast.success("Mission dupliquée (dates décalées de +7 jours)");
      nav(`/app/missions/${data.id}`);
    } catch (err) {
      const status = err.response?.status;
      const detail = err.response?.data?.detail || "Erreur lors de la duplication";
      if (status === 402) {
        setUpgrade(typeof detail === "string" ? detail : "Limite atteinte");
      } else {
        toast.error(typeof detail === "string" ? detail : "Erreur lors de la duplication");
      }
    }
  };

  return (
    <div data-testid="missions-page">
      <UpgradeModal open={!!upgrade} onClose={()=>setUpgrade(null)} message={upgrade}/>
      <Toaster position="top-right" richColors/>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[11px] sm:text-xs uppercase tracking-[0.16em] text-blue-700 font-bold">Missions</div>
          <h1 className="mt-1.5 text-[28px] leading-tight sm:text-3xl font-display font-bold tracking-tight">Toutes vos missions</h1>
        </div>
        <div className="grid grid-cols-2 sm:flex sm:items-center gap-2 w-full sm:w-auto">
          <button type="button" onClick={() => setShowArchived((v) => !v)}
            className="inline-flex items-center justify-center gap-2 border border-gray-300 hover:bg-gray-50 text-gray-700 px-3 sm:px-4 py-2.5 rounded-xl sm:rounded-md font-medium transition-colors">
            <Archive className="w-4 h-4"/> {showArchived ? "Missions actives" : "Archives"}
          </button>
          {!showArchived && (
            <Link to="/app/missions/new" data-testid="missions-new-btn"
              className="inline-flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-3 sm:px-4 py-2.5 rounded-xl sm:rounded-md font-medium transition-colors">
              <Plus className="w-4 h-4"/> Nouvelle mission
            </Link>
          )}
        </div>
      </div>

      <div className="mt-5 sm:mt-8">
        {loading ? <div className="text-gray-500">Chargement…</div> :
         missions.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500">
            {showArchived ? "Aucune mission archivée." : <>Aucune mission. <Link to="/app/missions/new" className="text-blue-600 font-medium">Créez-en une</Link>.</>}
          </div>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {missions.map((m) => (
                <div key={m.id} onClick={()=>nav(`/app/missions/${m.id}`)} data-testid={`mission-row-${m.id}`} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm active:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-950 truncate">{m.name}</div>
                      <div className="mt-1 text-xs text-gray-500 flex items-center gap-1.5">
                        <CalendarClock className="w-3.5 h-3.5 shrink-0"/>
                        <span>{m.first_date || "Date à définir"}{m.last_date && m.last_date !== m.first_date ? ` → ${m.last_date}` : ""}</span>
                      </div>
                      {m.location && <div className="mt-1 text-xs text-gray-500 truncate">{m.location}</div>}
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-lg border font-medium shrink-0 ${m.status === "filled" ? "status-confirmed" : m.status === "cancelled" ? "status-cancelled" : "status-contacted"}`}>
                      {MISSION_STATUS_LABEL[m.status] || m.status}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Shifts</div>
                      <div className="text-sm font-semibold text-gray-900 mt-0.5">{(m.shifts || []).length}</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2">
                      <div className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Équipe</div>
                      <div className="text-sm font-semibold text-gray-900 mt-0.5">{m.total_confirmed}/{m.total_needed}</div>
                    </div>
                  </div>
                  {!showArchived && (
                    <button onClick={(e)=>duplicate(e, m.id)} data-testid={`duplicate-mission-${m.id}`} className="mt-3 w-full inline-flex items-center justify-center gap-1.5 text-xs font-medium text-gray-600 border border-gray-200 rounded-xl py-2.5 bg-white active:bg-gray-50">
                      <Copy className="w-3.5 h-3.5"/> Dupliquer
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left uppercase text-xs tracking-widest">
                  <tr>
                    <th className="px-6 py-3">Mission</th>
                    <th className="px-6 py-3 hidden sm:table-cell">Période</th>
                    <th className="px-6 py-3 hidden md:table-cell">Lieu</th>
                    <th className="px-6 py-3">Shifts</th>
                    <th className="px-6 py-3">Équipe</th>
                    <th className="px-6 py-3">Statut</th>
                    <th className="px-6 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {missions.map((m) => (
                    <tr key={m.id} onClick={()=>nav(`/app/missions/${m.id}`)} data-testid={`mission-row-${m.id}`}
                      className="hover:bg-gray-50 cursor-pointer transition-colors">
                      <td className="px-6 py-4"><span className="font-medium text-gray-900">{m.name}</span></td>
                      <td className="px-6 py-4 hidden sm:table-cell text-gray-600">
                        <div className="flex items-center gap-2"><CalendarClock className="w-4 h-4 text-gray-400"/>{m.first_date || "—"}{m.last_date && m.last_date !== m.first_date ? ` → ${m.last_date}` : ""}</div>
                      </td>
                      <td className="px-6 py-4 hidden md:table-cell text-gray-600">{m.location}</td>
                      <td className="px-6 py-4 text-gray-900">{(m.shifts || []).length}</td>
                      <td className="px-6 py-4 text-gray-900 font-medium">{m.total_confirmed}/{m.total_needed}</td>
                      <td className="px-6 py-4">
                        <span className={`text-xs px-2 py-1 rounded-md border font-medium ${m.status === "filled" ? "status-confirmed" : m.status === "cancelled" ? "status-cancelled" : "status-contacted"}`}>
                          {MISSION_STATUS_LABEL[m.status] || m.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!showArchived && (
                          <button onClick={(e)=>duplicate(e, m.id)} data-testid={`duplicate-mission-${m.id}`} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600" title="Dupliquer">
                            <Copy className="w-3.5 h-3.5"/> Dupliquer
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
