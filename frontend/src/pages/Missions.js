import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Plus, CalendarClock, Copy } from "lucide-react";
import { api } from "../lib/api";
import { MISSION_STATUS_LABEL } from "../lib/statusMap";
import { toast, Toaster } from "sonner";

export default function Missions() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);
  const nav = useNavigate();

  const load = () => {
    setLoading(true);
    api.get("/missions").then((r) => setMissions(r.data)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

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
        toast.error(detail, {
          duration: 8000,
          action: { label: "Passer au Pro", onClick: () => nav("/pricing") },
        });
      } else {
        toast.error(typeof detail === "string" ? detail : "Erreur lors de la duplication");
      }
    }
  };

  return (
    <div data-testid="missions-page">
      <Toaster position="top-right" richColors/>
      <div className="flex items-end justify-between">
        <div>
          <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Missions</div>
          <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Toutes vos missions</h1>
        </div>
        <Link to="/app/missions/new" data-testid="missions-new-btn"
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 rounded-md font-medium transition-colors">
          <Plus className="w-4 h-4"/> Nouvelle mission
        </Link>
      </div>

      <div className="mt-8">
        {loading ? <div className="text-gray-500">Chargement…</div> :
         missions.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-xl p-10 text-center text-gray-500">
            Aucune mission. <Link to="/app/missions/new" className="text-blue-600 font-medium">Créez-en une</Link>.
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
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
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <Link to={`/app/missions/${m.id}`} data-testid={`mission-row-${m.id}`} className="font-medium text-gray-900 hover:text-blue-600">
                        {m.name}
                      </Link>
                    </td>
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
                      <button onClick={(e)=>duplicate(e, m.id)} data-testid={`duplicate-mission-${m.id}`} className="inline-flex items-center gap-1 text-xs text-gray-600 hover:text-blue-600" title="Dupliquer">
                        <Copy className="w-3.5 h-3.5"/> Dupliquer
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
