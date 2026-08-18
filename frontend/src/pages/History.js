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
      <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Historique</div>
      <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Missions passées</h1>

      <div className="mt-8 bg-white border border-gray-200 rounded-xl overflow-hidden">
        {loading ? <div className="p-10 text-gray-500">Chargement…</div> :
         missions.length === 0 ? (
          <div className="p-10 text-center text-gray-500">Aucune mission dans l'historique.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 text-left uppercase text-xs tracking-widest">
              <tr>
                <th className="px-6 py-3">Mission</th>
                <th className="px-6 py-3 hidden sm:table-cell">Période</th>
                <th className="px-6 py-3">Shifts</th>
                <th className="px-6 py-3">Résultat</th>
                <th className="px-6 py-3">Statut</th>
                <th className="px-6 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {missions.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium">{m.name}</td>
                  <td className="px-6 py-4 hidden sm:table-cell text-gray-600">{m.first_date || "—"}{m.last_date && m.last_date !== m.first_date ? ` → ${m.last_date}` : ""}</td>
                  <td className="px-6 py-4">{(m.shifts || []).length}</td>
                  <td className="px-6 py-4">{m.total_confirmed}/{m.total_needed}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs px-2 py-1 rounded-md border font-medium ${m.status === "filled" ? "status-confirmed" : m.status === "cancelled" ? "status-cancelled" : "status-contacted"}`}>
                      {MISSION_STATUS_LABEL[m.status] || m.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <Link to={`/app/missions/${m.id}`} data-testid={`history-view-${m.id}`} className="text-blue-600 hover:text-blue-700">Voir →</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
