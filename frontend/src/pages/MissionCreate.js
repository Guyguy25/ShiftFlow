import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";

const TYPES = [
  { v: "montage", l: "Montage" },
  { v: "demontage", l: "Démontage" },
  { v: "montage_demontage", l: "Montage + Démontage" },
  { v: "technique", l: "Technique / régie" },
  { v: "autre", l: "Autre" },
];

const emptyShift = () => ({
  date: "", start_time: "", end_time: "",
  people_needed: 4, rate_hourly: 15,
  mission_type: "montage", skill_required: "", description: "",
});

function estimate(sh) {
  try {
    if (!sh.start_time || !sh.end_time) return 0;
    const [sh1, sm1] = sh.start_time.split(":").map(Number);
    const [sh2, sm2] = sh.end_time.split(":").map(Number);
    if (isNaN(sh1) || isNaN(sh2)) return 0;
    let hours = (sh2 + sm2/60) - (sh1 + sm1/60);
    if (hours <= 0) hours += 24;
    const rate = Number(sh.rate_hourly) || 0;
    const people = Number(sh.people_needed) || 0;
    return Math.round(hours * rate * people * 100) / 100;
  } catch { return 0; }
}

export default function MissionCreate() {
  const nav = useNavigate();
  const [mission, setMission] = useState({
    name: "", location: "", address: "", description: "",
    cascade_enabled: true, followup_hours: 2,
  });
  const [shifts, setShifts] = useState([emptyShift()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const setM = (k, v) => setMission({ ...mission, [k]: v });
  const setS = (i, k, v) => setShifts(shifts.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const addShift = () => setShifts([...shifts, emptyShift()]);
  const removeShift = (i) => setShifts(shifts.length > 1 ? shifts.filter((_, idx) => idx !== i) : shifts);

  const submit = async (e) => {
    e.preventDefault(); setError(""); setLoading(true);
    try {
      const payload = {
        ...mission,
        followup_hours: Number(mission.followup_hours),
        shifts: shifts.map(s => ({
          ...s,
          people_needed: Number(s.people_needed),
          rate_hourly: Number(s.rate_hourly),
        })),
      };
      const { data } = await api.post("/missions", payload);
      nav(`/app/missions/${data.id}?step=select`);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setLoading(false); }
  };

  const inputCls = "mt-1 w-full h-11 px-3 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white";

  return (
    <div className="max-w-4xl" data-testid="mission-create-page">
      <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Nouvelle mission</div>
      <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Créer une mission</h1>
      <p className="text-gray-500 mt-1">Renseignez les infos de la mission et ajoutez un ou plusieurs shifts (journées). Vous sélectionnerez les intervenants à l'étape suivante, shift par shift.</p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        {/* Mission block */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 sm:p-8 space-y-5">
          <h2 className="font-display font-bold text-lg">Mission</h2>
          <div>
            <label className="text-sm font-medium text-gray-700">Nom de la mission *</label>
            <input required data-testid="mc-name" className={inputCls} value={mission.name} onChange={(e)=>setM("name", e.target.value)} placeholder="Montage Salon Nike"/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium text-gray-700">Lieu *</label>
              <input required data-testid="mc-location" className={inputCls} value={mission.location} onChange={(e)=>setM("location", e.target.value)} placeholder="Lille Grand Palais"/>
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700">Adresse</label>
              <input data-testid="mc-address" className={inputCls} value={mission.address} onChange={(e)=>setM("address", e.target.value)} placeholder="1 Bd des Cités Unies, Lille"/>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-700">Description</label>
            <textarea data-testid="mc-desc" rows={2} className="mt-1 w-full px-3 py-2 rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" value={mission.description} onChange={(e)=>setM("description", e.target.value)} placeholder="Détails généraux, contact sur place…"/>
          </div>
          <label className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-md px-4 py-3">
            <input type="checkbox" data-testid="mc-cascade" checked={mission.cascade_enabled} onChange={(e)=>setM("cascade_enabled", e.target.checked)} className="w-4 h-4 accent-blue-600"/>
            <div>
              <div className="text-sm font-medium text-gray-900">Cascade automatique</div>
              <div className="text-xs text-gray-600">En cas de refus ou absence, contacter automatiquement le prochain intervenant pour chaque shift.</div>
            </div>
          </label>
        </div>

        {/* Shifts */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg">Shifts / Journées</h2>
            <button type="button" onClick={addShift} data-testid="mc-add-shift" className="inline-flex items-center gap-2 text-sm bg-white border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-md">
              <Plus className="w-4 h-4"/> Ajouter un shift
            </button>
          </div>
          {shifts.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-6 space-y-4" data-testid={`mc-shift-${i}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Shift {i + 1}</div>
                {shifts.length > 1 && (
                  <button type="button" onClick={()=>removeShift(i)} data-testid={`mc-remove-shift-${i}`} className="p-1.5 rounded hover:bg-red-50 text-red-600">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Date *</label>
                  <input type="date" required data-testid={`mc-shift-${i}-date`} className={inputCls} value={s.date} onChange={(e)=>setS(i, "date", e.target.value)}/>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Début *</label>
                  <input type="time" required data-testid={`mc-shift-${i}-start`} className={inputCls} value={s.start_time} onChange={(e)=>setS(i, "start_time", e.target.value)}/>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Fin *</label>
                  <input type="time" required data-testid={`mc-shift-${i}-end`} className={inputCls} value={s.end_time} onChange={(e)=>setS(i, "end_time", e.target.value)}/>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Personnes *</label>
                  <input type="number" min="1" required data-testid={`mc-shift-${i}-people`} className={inputCls} value={s.people_needed} onChange={(e)=>setS(i, "people_needed", e.target.value)}/>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Tarif horaire (€/h) *</label>
                  <input type="number" min="0" step="0.5" required data-testid={`mc-shift-${i}-rate`} className={inputCls} value={s.rate_hourly} onChange={(e)=>setS(i, "rate_hourly", e.target.value)}/>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Type</label>
                  <select data-testid={`mc-shift-${i}-type`} className={inputCls} value={s.mission_type} onChange={(e)=>setS(i, "mission_type", e.target.value)}>
                    {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-gray-700">Compétence requise</label>
                  <input data-testid={`mc-shift-${i}-skill`} className={inputCls} value={s.skill_required} onChange={(e)=>setS(i, "skill_required", e.target.value)} placeholder="ex: technique"/>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700">Consignes du shift</label>
                  <input data-testid={`mc-shift-${i}-desc`} className={inputCls} value={s.description} onChange={(e)=>setS(i, "description", e.target.value)} placeholder="Point de RDV, tenue, etc."/>
                </div>
              </div>
              <div className="text-xs text-gray-500 border-t border-gray-100 pt-3" data-testid={`mc-shift-${i}-estimate`}>
                Estimation coût brut : <span className="font-semibold text-gray-900">{estimate(s)} €</span>
                <span className="text-gray-400"> ({s.people_needed} pers. × {s.rate_hourly}€/h)</span>
              </div>
            </div>
          ))}
        </div>

        {error && <div className="text-sm text-red-600" data-testid="mc-error">{error}</div>}
        <div className="flex justify-end gap-3">
          <button type="button" onClick={()=>nav("/app/missions")} className="px-4 py-2.5 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">Annuler</button>
          <button type="submit" disabled={loading} data-testid="mc-submit" className="px-5 py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">
            {loading ? "Création…" : "Créer la mission"}
          </button>
        </div>
      </form>
    </div>
  );
}
