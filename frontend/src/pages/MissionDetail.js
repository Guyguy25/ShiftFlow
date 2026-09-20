import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { CalendarClock, MapPin, Euro, Users, Copy, Trash2, XCircle, ArrowUp, ArrowDown, ExternalLink, Ban, Plus, CheckCircle2, AlertTriangle, CopyPlus, RefreshCw } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { SLOT_STATUS_LABEL, slotClass, MISSION_STATUS_LABEL } from "../lib/statusMap";
import { toast, Toaster } from "sonner";
import WhatsAppQrGuide from "../components/WhatsAppQrGuide";

const TYPE_LABEL = {
  montage: "Montage", demontage: "Démontage", montage_demontage: "Montage + Démontage",
  technique: "Technique", autre: "Autre",
};

function WhatsAppConnectModal({ onClose, onConnected }) {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  const completedRef = useRef(false);

  const refreshStatus = useCallback(async () => {
    try {
      const { data } = await api.get("/whatsapp/status");
      setStatus(data);
      setError("");
      return data;
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Impossible de contacter WhatsApp.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const startSession = useCallback(async () => {
    if (starting) return;
    setStarting(true);
    try {
      await api.post("/whatsapp/session/start");
      await refreshStatus();
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Impossible de démarrer WhatsApp.");
    } finally {
      setStarting(false);
    }
  }, [refreshStatus, starting]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const current = await refreshStatus();
      if (!cancelled && current && !current.connected && !current.hasQR && !current.starting) {
        await startSession();
      }
    })();
    return () => { cancelled = true; };
  }, [refreshStatus, startSession]);

  useEffect(() => {
    if (!status?.connected || completedRef.current) return;
    completedRef.current = true;
    onConnected();
  }, [status?.connected, onConnected]);

  useEffect(() => {
    if (status?.connected) return undefined;
    const timer = setInterval(refreshStatus, 1500);
    return () => clearInterval(timer);
  }, [status?.connected, refreshStatus]);

  return (
    <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-white rounded-2xl w-full max-w-md p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-widest text-green-700 font-bold">WhatsApp requis</div>
            <h3 className="mt-1 font-display font-bold text-xl">Connectez votre WhatsApp</h3>
          </div>
          <button type="button" onClick={onClose} className="p-1 rounded hover:bg-gray-100 text-gray-500">×</button>
        </div>
        <p className="mt-3 text-sm text-gray-600">
          ShiftFlow envoie les missions uniquement via votre compte WhatsApp. Connectez-le pour lancer la cascade.
        </p>

        {status?.connected ? (
          <div className="mt-6 rounded-xl border border-green-200 bg-green-50 p-4 text-center text-sm text-green-800">
            WhatsApp est connecté. Lancement de la cascade…
          </div>
        ) : status?.hasQR && status?.qr ? (
          <WhatsAppQrGuide qr={status.qr} />
        ) : (
          <div className="mt-6 rounded-xl border border-gray-200 bg-gray-50 p-6 text-center">
            <RefreshCw className="w-7 h-7 mx-auto text-gray-400 animate-spin" />
            <div className="mt-3 text-sm font-medium text-gray-800">Préparation de votre session WhatsApp…</div>
            <div className="mt-1 text-xs text-gray-500">Le QR code apparaîtra automatiquement.</div>
          </div>
        )}

        {error && <div className="mt-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md p-3">{error}</div>}
        {!loading && !status?.connected && !status?.hasQR && !status?.starting && (
          <button type="button" onClick={startSession} disabled={starting} className="mt-4 w-full py-2.5 rounded-md bg-green-600 hover:bg-green-700 text-white font-medium disabled:opacity-60">
            {starting ? "Connexion…" : "Réessayer"}
          </button>
        )}
      </div>
    </div>
  );
}

function ShiftSelector({ mission, shift, workers, onSelected }) {
  const nav = useNavigate();
  const returnTo = `/app/missions/${mission.id}?step=select&shift=${encodeURIComponent(shift.id)}`;
  const openAddWorkers = () => nav(`/app/workers?add=1&returnTo=${encodeURIComponent(returnTo)}`);
  const [selected, setSelected] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [connectOpen, setConnectOpen] = useState(false);
  const [waitingForWhatsApp, setWaitingForWhatsApp] = useState(false);

  const toggle = (id) => setSelected((s) => s.includes(id) ? s.filter(x => x !== id) : [...s, id]);
  const move = (idx, dir) => setSelected((s) => {
    const arr = [...s]; const j = idx + dir;
    if (j < 0 || j >= arr.length) return arr;
    [arr[idx], arr[j]] = [arr[j], arr[idx]];
    return arr;
  });

  const sendSelection = useCallback(async () => {
    if (selected.length === 0) { setError("Sélectionnez au moins un intervenant"); return; }
    setSaving(true); setError(""); setWaitingForWhatsApp(false); setConnectOpen(false);
    try {
      await api.post(`/shifts/${shift.id}/select-workers`, { worker_ids: selected });
      toast.success("Cascade démarrée sur ce shift");
      onSelected();
    } catch (err) {
      const detail = formatApiError(err.response?.data?.detail) || err.message;
      if (/whatsapp/i.test(detail) && /connect|déconnect|pas connecté|not connected/i.test(detail)) {
        setWaitingForWhatsApp(true);
        setConnectOpen(true);
      } else {
        setError(detail);
      }
    } finally { setSaving(false); }
  }, [onSelected, selected, shift.id]);

  const submit = async () => {
    if (selected.length === 0) { setError("Sélectionnez au moins un intervenant"); return; }
    try {
      const { data } = await api.get("/whatsapp/status");
      if (!data.connected) {
        setWaitingForWhatsApp(true);
        setConnectOpen(true);
        return;
      }
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Impossible de vérifier la connexion WhatsApp.");
      return;
    }
    await sendSelection();
  };

  const onWhatsAppConnected = useCallback(() => {
    if (!waitingForWhatsApp && !connectOpen) return;
    setConnectOpen(false);
    setWaitingForWhatsApp(false);
    sendSelection();
  }, [connectOpen, sendSelection, waitingForWhatsApp]);

  if (workers.length === 0) {
    return (
      <div className="rounded-2xl border border-blue-200 bg-gradient-to-b from-blue-50/80 to-white px-6 py-9 text-center" data-testid={`shift-empty-workers-${shift.id}`}>
        <div className="mx-auto w-12 h-12 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-sm">
          <Users className="w-5 h-5" />
        </div>
        <h3 className="mt-4 text-lg font-semibold text-gray-900">Ajoutez vos premiers intervenants</h3>
        <p className="mt-1.5 text-sm text-gray-600 max-w-md mx-auto leading-relaxed">
          Importez votre équipe en quelques clics depuis WhatsApp, votre téléphone ou ajoutez quelqu’un manuellement.
        </p>
        <button
          type="button"
          onClick={openAddWorkers}
          data-testid={`shift-add-first-workers-${shift.id}`}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-sm font-semibold transition-colors shadow-sm"
        >
          <Plus className="w-4 h-4" /> Ajouter mes premiers intervenants
        </button>
        <div className="mt-3 text-xs text-gray-400">Vous reviendrez automatiquement sur cette mission après l’ajout.</div>
      </div>
    );
  }

  return (
    <>
      <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div>
          <div className="text-sm font-semibold text-gray-900">Composez votre équipe</div>
          <div className="text-xs text-gray-500 mt-0.5">Sélectionnez les intervenants puis définissez l’ordre dans lequel ShiftFlow les contactera.</div>
        </div>
        <div className="text-xs text-gray-500"><span className="font-semibold text-gray-900">{selected.length}</span> sélectionné{selected.length > 1 ? "s" : ""}</div>
      </div>

      <div className="grid md:grid-cols-2 gap-5" data-testid={`shift-selector-${shift.id}`}>
        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Disponibles</div>
            <span className="text-[11px] font-medium text-gray-500 bg-gray-100 rounded-full px-2 py-0.5">{workers.length}</span>
          </div>

          <div className="border border-gray-200 rounded-xl overflow-hidden bg-white shadow-sm">
            <div className="max-h-80 overflow-y-auto">
              {workers.map((w) => {
                const on = selected.includes(w.id);
                return (
                  <button type="button" key={w.id} onClick={()=>toggle(w.id)}
                    data-testid={`select-worker-${shift.id}-${w.id}`}
                    className={`w-full flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 last:border-0 text-left transition-colors ${on ? "bg-blue-50 hover:bg-blue-50" : "hover:bg-gray-50"}`}>
                    <div className="min-w-0">
                      <div className={`text-sm font-medium truncate ${on ? "text-blue-900" : "text-gray-900"}`}>{w.first_name} {w.last_name}</div>
                      <div className="text-xs text-gray-500 mt-0.5">{w.phone}</div>
                    </div>
                    <div className={`w-6 h-6 rounded-full border flex items-center justify-center shrink-0 transition-colors ${on ? "bg-blue-600 border-blue-600 text-white" : "border-gray-300 text-transparent"}`}>
                      <CheckCircle2 className="w-4 h-4" />
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={openAddWorkers}
              data-testid={`shift-add-more-workers-${shift.id}`}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 border-t border-gray-200 bg-gray-50/70 hover:bg-blue-50 text-sm font-medium text-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" /> Ajouter des intervenants
            </button>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs uppercase tracking-widest text-gray-500 font-semibold">Ordre de priorité</div>
            <span className="text-[11px] text-gray-400">1 = contacté en premier</span>
          </div>

          <div className="border border-gray-200 rounded-xl min-h-[9rem] bg-white shadow-sm overflow-hidden">
            {selected.length === 0 ? (
              <div className="min-h-[9rem] px-6 flex flex-col items-center justify-center text-center">
                <Users className="w-5 h-5 text-gray-300" />
                <div className="mt-2 text-sm font-medium text-gray-500">Aucun intervenant sélectionné</div>
                <div className="mt-0.5 text-xs text-gray-400">Cliquez sur une personne à gauche pour l’ajouter.</div>
              </div>
            ) : selected.map((wid, idx) => {
              const w = workers.find(x => x.id === wid);
              if (!w) return null;
              return (
                <div key={wid} className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-100 last:border-0">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                    <div className="text-sm font-medium text-gray-900 truncate">{w.first_name} {w.last_name}</div>
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button type="button" onClick={()=>move(idx,-1)} disabled={idx === 0} title="Monter dans la priorité" className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 disabled:opacity-25 disabled:cursor-not-allowed"><ArrowUp className="w-4 h-4"/></button>
                    <button type="button" onClick={()=>move(idx,1)} disabled={idx === selected.length - 1} title="Descendre dans la priorité" className="p-1.5 hover:bg-gray-100 rounded-md text-gray-500 disabled:opacity-25 disabled:cursor-not-allowed"><ArrowDown className="w-4 h-4"/></button>
                    <button type="button" onClick={()=>toggle(wid)} title="Retirer" className="p-1.5 hover:bg-red-50 text-red-500 rounded-md"><XCircle className="w-4 h-4"/></button>
                  </div>
                </div>
              );
            })}
          </div>

          {error && <div className="mt-2 text-sm text-red-600">{error}</div>}
          <button onClick={submit} disabled={saving || selected.length === 0} data-testid={`submit-selection-${shift.id}`}
            className="mt-3 w-full py-3 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold disabled:bg-gray-200 disabled:text-gray-400 disabled:cursor-not-allowed text-sm transition-colors shadow-sm disabled:shadow-none">
            {saving ? "Envoi…" : selected.length === 0 ? "Sélectionnez au moins un intervenant" : `Lancer la cascade (${selected.length})`}
          </button>
        </div>
      </div>
      {connectOpen && <WhatsAppConnectModal onClose={() => { setConnectOpen(false); setWaitingForWhatsApp(false); }} onConnected={onWhatsAppConnected} />}
    </>
  );
}

function ShiftCard({ mission, shift, workers, onReload, autoExpand = false }) {
  const noSlots = !shift.slots || shift.slots.length === 0;
  const [expandSelect, setExpandSelect] = useState(autoExpand && noSlots);
  const filled = shift.confirmed_count >= shift.people_needed;
  const missing = Math.max(0, shift.people_needed - shift.confirmed_count);

  useEffect(() => {
    if (autoExpand && noSlots) setExpandSelect(true);
  }, [autoExpand, noSlots]);

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
  const [searchParams] = useSearchParams();
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
  const shouldOpenSelection = searchParams.get("step") === "select";
  const requestedShiftId = searchParams.get("shift");
  const firstSelectableShiftId = (m.shifts || []).find((sh) => !sh.slots || sh.slots.length === 0)?.id;
  const autoExpandShiftId = shouldOpenSelection
    ? ((requestedShiftId && (m.shifts || []).some((sh) => sh.id === requestedShiftId)) ? requestedShiftId : firstSelectableShiftId)
    : null;

  const cancelMission = async () => {
    if (!window.confirm("Annuler définitivement cette mission ?")) return;
    await api.post(`/missions/${id}/cancel`);
    toast.success("Mission annulée");
    await load();
  };
  const deleteMission = async () => {
    if (!window.confirm("Archiver cette mission ? Elle restera consultable dans la section Archives.")) return;
    await api.delete(`/missions/${id}`);
    toast.success("Mission archivée");
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
          <ShiftCard
            key={sh.id}
            mission={m}
            shift={sh}
            workers={workers}
            onReload={load}
            autoExpand={sh.id === autoExpandShiftId}
          />
        ))}
      </div>
    </div>
  );
}
