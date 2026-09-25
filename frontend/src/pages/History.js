import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api";
import { MISSION_STATUS_LABEL } from "../lib/statusMap";

export default function History() {
  const [missions, setMissions] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get("/missions").then((r) => {
      const today = new Date().toISOString().slice(0, 10);
      const past = r.data.filter((m) => (m.last_date && m.last_date < today) || m.status === "cancelled" || m.status === "filled");
      setMissions(past);
    }).finally(()=>setLoading(false));
  }, []);

  return (
    <div data-testid="history-page">
      <div className="text-[11px] sm:text-xs uppercase tracking-[0.16em] text-blue-700 font-bold">Historique</div>
      <h1 className="mt-1.5 text-[28px] leading-tight sm:text-3xl font-display font-bold tracking-tight">Missions passées</h1>

      <div className="mt-5 sm:mt-8">
        {loading ? <div className="text-gray-500">Chargement…</div> :
         missions.length === 0 ? (
          <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-10 text-center text-gray-500">Aucune mission dans l'historique.</div>
        ) : (
          <>
            <div className="sm:hidden space-y-3">
              {missions.map((m) => (
                <Link key={m.id} to={`/app/missions/${m.id}`} data-testid={`history-view-${m.id}`} className="block bg-white border border-gray-200 rounded-2xl p-4 shadow-sm active:bg-gray-50">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-semibold text-gray-950 truncate">{m.name}</div>
                      <div className="text-xs text-gray-500 mt-1">{m.first_date || "—"}{m.last_date && m.last_date !== m.first_date ? ` → ${m.last_date}` : ""}</div>
                    </div>
                    <span className={`text-[11px] px-2 py-1 rounded-lg border font-medium shrink-0 ${m.status === "filled" ? "status-confirmed" : m.status === "cancelled" ? "status-cancelled" : "status-contacted"}`}>
                      {MISSION_STATUS_LABEL[m.status] || m.status}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                    <div className="rounded-xl bg-gray-50 px-3 py-2"><span className="text-xs text-gray-500">Shifts</span><div className="font-semibold">{(m.shifts || []).length}</div></div>
                    <div className="rounded-xl bg-gray-50 px-3 py-2"><span className="text-xs text-gray-500">Résultat</span><div className="font-semibold">{m.total_confirmed}/{m.total_needed}</div></div>
                  </div>
                </Link>
              ))}
            </div>
            <div className="hidden sm:block bg-white border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-gray-500 text-left uppercase text-xs tracking-widest">
                  <tr><th className="px-6 py-3">Mission</th><th className="px-6 py-3">Période</th><th className="px-6 py-3">Shifts</th><th className="px-6 py-3">Résultat</th><th className="px-6 py-3">Statut</th><th className="px-6 py-3"></th></tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {missions.map((m) => (
                    <tr key={m.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 font-medium">{m.name}</td>
                      <td className="px-6 py-4 text-gray-600">{m.first_date || "—"}{m.last_date && m.last_date !== m.first_date ? ` → ${m.last_date}` : ""}</td>
                      <td className="px-6 py-4">{(m.shifts || []).length}</td>
                      <td className="px-6 py-4">{m.total_confirmed}/{m.total_needed}</td>
                      <td className="px-6 py-4"><span className={`text-xs px-2 py-1 rounded-md border font-medium ${m.status === "filled" ? "status-confirmed" : m.status === "cancelled" ? "status-cancelled" : "status-contacted"}`}>{MISSION_STATUS_LABEL[m.status] || m.status}</span></td>
                      <td className="px-6 py-4 text-right"><Link to={`/app/missions/${m.id}`} data-testid={`history-view-${m.id}`} className="text-blue-600 hover:text-blue-700">Voir →</Link></td>
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
