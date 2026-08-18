import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { CalendarClock, MapPin, Euro, Users, Copy, Trash2, XCircle, ArrowUp, ArrowDown, ExternalLink, Ban, Plus, CheckCircle2, AlertTriangle, CopyPlus } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { SLOT_STATUS_LABEL, slotClass, MISSION_STATUS_LABEL } from "../lib/statusMap";
import { toast, Toaster } from "sonner";

const TYPE_LABEL = {
  montage: "Montage", demontage: "Démontage", montage_demontage: "Montage + Démontage",
  technique: "Technique", autre: "Autre",
};

function ShiftSelector({ mission, shift, workers, onSelected }) {
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const move = (idx, dir) => setSelected((s) => {
    const arr = [...s]; const j = idx + dir;
    if (j < 0 || j >= arr.length) return arr;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return arr;
  });

  const submit = async () => {
    if (selected.length === 0) { setError("Sélectionnez au moins un intervenant"); return; }
    setSaving(true); setError("");
    try {
      await api.post(`/shifts/${shift.id}/select-workers`, { worker_ids: selected });
      toast.success("Cascade démarrée sur ce shift");
      onSelected();
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || err.message);
    } finally { setSaving(false); }
  };

  return (
    <div className="grid md:grid-cols-2 gap-6" data-testid={`shift-selector-${shift.id}`}>
      <div>
        <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-2">Disponibles</div>
        <div className="border border-gray-200 rounded-md max-h-80 overflow-y-auto">
          {workers.map((w) => {
            const on = selected.includes(w.id);
            return (
              <button type="button" key={w.id} onClick={()=>toggle(w.id)}
                data-testid={`select-worker-${shift.id}-${w.id}`}
                className={`w-full flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0 text-left hover:bg-gray-50 ${on ? "bg-blue-50" : ""}`}>
                <div>
                  <div className="text-sm font-medium">{w.first_name} {w.last_name}</div>
                  <div className="text-xs text-gray-500">{w.phone}</div>
                </div>
                {on && <span className="text-xs font-bold text-blue-700">✓</span>}
              </button>
            );
          })}
        </div>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold mb-2">Ordre de priorité ({selected.length})</div>
        <div className="border border-gray-200 rounded-md min-h-[6rem]">
          {selected.length === 0 ? (
            <div className="p-6 text-sm text-gray-400 text-center">Aucun sélectionné</div>
          ) : selected.map((wid, idx) => {
            const w = workers.find(x => x.id === wid);
            if (!w) return null;
            return (
              <div key={wid} className="flex items-center justify-between px-4 py-2.5 border-b border-gray-100 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">{idx + 1}</span>
                  <div className="text-sm">{w.first_name} {w.last_name}</div>
                </div>
                <div className="flex gap-1">
                  <button onClick={()=>move(idx,-1)} className="p-1 hover:bg-gray-100 rounded"><ArrowUp className="w-4 h-4"/></button>
                  <button onClick={()=>move(idx,1)} className="p-1 hover:bg-gray-100 rounded"><ArrowDown className="w-4 h-4"/></button>
                  <button onClick={()=>toggle(wid)} className="p-1 hover:bg-red-50 text-red-600 rounded"><XCircle className="w-4 h-4"/></button>
                </div>
              </div>
            );
          })}
        </div>
        {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
        <button onClick={submit} disabled={saving} data-testid={`submit-selection-${shift.id}`}
          className="mt-3 w-full py-2.5 rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60 text-sm">
          {saving ? "Envoi…" : `Lancer la cascade (${selected.length})`}
        </button>
      </div>
    </div>
  );
}

function ShiftCard({ mission, shift, workers, onReload }) {
  const [expandSelect, setExpandSelect] = useState(false);
  const filled = shift.confirmed_count >= shift.people_needed;
  const missing = Math.max(0, shift.people_needed - shift.confirmed_count);
  const noSlots = !shift.slots || shift.slots.length === 0;

  const copyLink = (token) => {
    const url = `${window.location.origin}/m/${token}`;
    navigator.clipboard.writeText(url);
    toast.success("Lien copié !");
  };
  const markNoAnswer = async (slotId) => {
    await api.post(`/mission-workers/${slotId}/mark-no-answer`);
    toast.success("Marqué sans réponse. Cascade appliquée.");
    onReload();
  };
  const duplicateShift = async () => {
    const suggested = shift.date;
    const nd = window.prompt("Nouvelle date pour la copie du shift (YYYY-MM-DD) ?", suggested);
    if (!nd) return;
    try {
      await api.post(`/shifts/${shift.id}/duplicate`, { new_date: nd });
      toast.success("Shift dupliqué");
      onReload();
    } catch (e) { toast.error("Erreur de duplication"); }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden" data-testid={`shift-card-${shift.id}`}>
      <div className="px-6 py-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">{TYPE_LABEL[shift.mission_type]}</div>
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-700">
            <div className="flex items-center gap-1.5 font-medium"><CalendarClock className="w-4 h-4 text-gray-400"/>{shift.date}</div>
            <div>{shift.start_time} → {shift.end_time}</div>
            <div className="flex items-center gap-1.5"><Users className="w-4 h-4 text-gray-400"/>{shift.confirmed_count}/{shift.people_needed}</div>
            <div className="flex items-center gap-1.5"><Euro className="w-4 h-4 text-gray-400"/>{shift.rate_hourly} €/h</div>
          </div>
          <div className="mt-1 text-xs text-gray-500" data-testid={`shift-estimate-${shift.id}`}>
            Estimation coût : <span className="font-semibold text-gray-900">{shift.estimated_cost} €</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {filled ? (
            <span className="text-xs px-2 py-1 rounded-md border font-medium status-confirmed inline-flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5"/>Équipe complète
            </span>
          ) : missing > 0 && mission.status !== "cancelled" ? (
            <span className="text-xs px-2 py-1 rounded-md border font-medium status-waiting inline-flex items-center gap-1">
              <AlertTriangle className="w-3.5 h-3.5"/>{missing} manquant{missing>1?"s":""}
            </span>
          ) : (
            <span className={`text-xs px-2 py-1 rounded-md border font-medium ${slotClass(shift.status)}`}>{MISSION_STATUS_LABEL[shift.status] || shift.status}</span>
          )}
          <button onClick={duplicateShift} data-testid={`duplicate-shift-${shift.id}`} title="Dupliquer ce shift" className="p-1.5 rounded hover:bg-gray-100 text-gray-500">
            <CopyPlus className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {noSlots ? (
        <div className="px-6 py-6">
          {!expandSelect ? (
            <button onClick={()=>setExpandSelect(true)} data-testid={`open-select-${shift.id}`}
              className="inline-flex items-center gap-2 text-sm bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-md">
              <Plus className="w-4 h-4"/> Sélectionner les intervenants
            </button>
          ) : (
            <ShiftSelector mission={mission} shift={shift} workers={workers} onSelected={()=>{ setExpandSelect(false); onReload(); }}/>
          )}
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {shift.slots.map((s) => (
            <div key={s.id} className="px-6 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2" data-testid={`slot-${s.id}`}>
              <div className="flex items-center gap-4">
                <span className="w-6 h-6 rounded-full bg-gray-100 text-gray-700 text-xs font-bold flex items-center justify-center">{s.priority + 1}</span>
                <div>
                  <div className="text-sm font-medium text-gray-900">{s.worker?.first_name} {s.worker?.last_name}</div>
                  <div className="text-xs text-gray-500">{s.worker?.phone}</div>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <span className={`text-xs px-2 py-1 rounded-md border font-medium ${slotClass(s.status)}`} data-testid={`slot-status-${s.id}`}>
                  {SLOT_STATUS_LABEL[s.status]}
                </span>
                {s.status === "contacted" && (
                  <button onClick={()=>markNoAnswer(s.id)} data-testid={`no-answer-${s.id}`} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 text-gray-600">
                    Sans réponse
                  </button>
                )}
                <button onClick={()=>copyLink(s.token)} data-testid={`copy-link-${s.id}`} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-1 text-gray-700">
                  <Copy className="w-3 h-3"/> Copier
                </button>
                <a href={`/m/${s.token}`} target="_blank" rel="noreferrer" data-testid={`open-link-${s.id}`} className="text-xs px-2 py-1 rounded border border-gray-300 hover:bg-gray-50 flex items-center gap-1 text-gray-700">
                  <ExternalLink className="w-3 h-3"/> Ouvrir
                </a>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function MissionDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const [data, setData] = useState(null);
  const [workers, setWorkers] = useState([]);

  const load = useCallback(async () => {
    const { data } = await api.get(`/missions/${id}`);
    setData(data);
  }, [id]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get("/workers").then((r) => setWorkers(r.data.filter((w) => w.active))); }, []);
  useEffect(() => {
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  if (!data) return <div className="text-gray-500">Chargement…</div>;
  const m = data;
  const totalCost = (m.shifts || []).reduce((sum, sh) => sum + (sh.estimated_cost || 0), 0);

  const cancelMission = async () => {
    if (!window.confirm("Annuler définitivement cette mission ?")) return;
    await api.post(`/missions/${id}/cancel`);
    toast.success("Mission annulée");
    await load();
  };
  const deleteMission = async () => {
    if (!window.confirm("Supprimer cette mission ? (irréversible)")) return;
    await api.delete(`/missions/${id}`);
    nav("/app/missions");
  };
  const duplicateMission = async () => {
    try {
      const { data } = await api.post(`/missions/${id}/duplicate`);
      toast.success("Mission dupliquée (dates +7 jours)");
      nav(`/app/missions/${data.id}`);
    } catch (e) { toast.error("Erreur de duplication"); }
  };

  return (
    <div data-testid="mission-detail-page">
      <Toaster position="top-right" richColors/>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Mission</div>
          <h1 className="mt-2 text-3xl font-display font-bold tracking-tight" data-testid="mission-title">{m.name}</h1>
          <div className="mt-2 flex flex-wrap gap-4 text-sm text-gray-600">
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4"/> {m.location}</div>
            {m.first_date && <div className="flex items-center gap-2"><CalendarClock className="w-4 h-4"/> {m.first_date}{m.last_date && m.last_date !== m.first_date ? ` → ${m.last_date}` : ""}</div>}
            <div className="flex items-center gap-2"><Users className="w-4 h-4"/> {m.total_confirmed}/{m.total_needed} confirmés</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-xs px-3 py-1.5 rounded-md border font-medium ${m.status === "filled" ? "status-confirmed" : m.status === "cancelled" ? "status-cancelled" : "status-contacted"}`}>
            {MISSION_STATUS_LABEL[m.status] || m.status}
          </span>
          <button onClick={duplicateMission} data-testid="mission-duplicate-btn" title="Dupliquer la mission" className="p-2 rounded-md border border-gray-300 text-gray-600 hover:text-blue-600 hover:border-blue-300">
            <CopyPlus className="w-4 h-4"/>
          </button>
          {m.status !== "cancelled" && (
            <button onClick={cancelMission} data-testid="mission-cancel-btn" className="p-2 rounded-md border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300">
              <Ban className="w-4 h-4"/>
            </button>
          )}
          <button onClick={deleteMission} data-testid="mission-delete-btn" className="p-2 rounded-md border border-gray-300 text-gray-600 hover:text-red-600 hover:border-red-300">
            <Trash2 className="w-4 h-4"/>
          </button>
        </div>
      </div>

      {m.description && <p className="mt-4 text-gray-600 max-w-3xl">{m.description}</p>}

      <div className="mt-6 bg-white border border-gray-200 rounded-xl p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3" data-testid="mission-total-progress">
        <div>
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Équipe totale</div>
          <div className="mt-1 text-2xl font-display font-bold">{m.total_confirmed}/{m.total_needed} confirmés</div>
        </div>
        <div className="text-right">
          <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Coût brut estimé</div>
          <div className="mt-1 text-2xl font-display font-bold" data-testid="mission-total-cost">{totalCost.toFixed(2)} €</div>
        </div>
      </div>

      <h2 className="mt-10 font-display font-bold text-xl">Shifts</h2>
      <div className="mt-4 space-y-4">
        {m.shifts.map((sh) => (
          <ShiftCard key={sh.id} mission={m} shift={sh} workers={workers} onReload={load}/>
        ))}
      </div>
    </div>
  );
}
