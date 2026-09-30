import React, { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Plus, Trash2 } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import UpgradeModal from "../components/UpgradeModal";

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
  const { user } = useAuth();
  const draftKey = `shiftflow_mission_draft_${user?.id || "anonymous"}`;
  const [savedDraft] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem(draftKey) || "null"); } catch (_) { return null; }
  });

  const nav = useNavigate();
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
  const [step, setStep] = useState(Math.min(2, savedDraft?.step || 0));
  const heading = useRef(null);
  const submitting = useRef(false);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const [mission, setMission] = useState(savedDraft?.mission || {
    name: "", location: "", address: "", description: "",
    cascade_enabled: true, followup_hours: 2,
  });
  const [shifts, setShifts] = useState(Array.isArray(savedDraft?.shifts) && savedDraft.shifts.length ? savedDraft.shifts : [emptyShift()]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [upgrade, setUpgrade] = useState(null);

  useEffect(() => {
    try { sessionStorage.setItem(draftKey, JSON.stringify({ mission, shifts, step })); } catch (_) { /* Storage can be unavailable. */ }
  }, [draftKey, mission, shifts, step]);

  const setM = (k, v) => setMission({ ...mission, [k]: v });
  const setS = (i, k, v) => setShifts(shifts.map((s, idx) => idx === i ? { ...s, [k]: v } : s));
  const addShift = () => setShifts([...shifts, emptyShift()]);
  const removeShift = (i) => setShifts(shifts.length > 1 ? shifts.filter((_, idx) => idx !== i) : shifts);

  const submit = async (e) => {
    e.preventDefault(); setError("");
    if (submitting.current) return;
    if (step === 0) {
      if (!mission.name.trim() || !mission.location.trim()) { setError("Indiquez le nom et le lieu de la mission."); return; }
      setStep(1); return;
    }
    if (shifts.some(s => !s.date || !s.start_time || !s.end_time || Number(s.people_needed) < 1 || !Number.isInteger(Number(s.people_needed)) || s.rate_hourly === "" || Number(s.rate_hourly) < 0)) { setError("Complétez la date, les horaires, le nombre de personnes et le tarif de chaque créneau."); setStep(1); return; }
    const pastShift = shifts.find(s => s.date && s.date < todayStr);
    if (pastShift) {
      setError("Un ou plusieurs shifts ont une date déjà passée. Corrigez la date avant de continuer.");
      setLoading(false);
      return;
    }
    if (step === 1) { setStep(2); return; }
    submitting.current = true; setLoading(true);
    try {
      const payload = {
        ...mission,
        meta_consent: localStorage.getItem("shiftflow_cookie_consent") === "accepted",
        followup_hours: Number(mission.followup_hours),
        shifts: shifts.map(s => ({
          ...s,
          people_needed: Number(s.people_needed),
          rate_hourly: Number(s.rate_hourly),
        })),
      };
      const { data } = await api.post("/missions", payload);
      sessionStorage.removeItem(draftKey);
      nav(`/app/missions/${data.id}?step=select`);
    } catch (err) {
      const status = err.response?.status;
      const detail = formatApiError(err.response?.data?.detail) || err.message;
      if (status === 402) {
        setUpgrade(detail);
      } else {
        setError(detail);
      }
    } finally { submitting.current = false; setLoading(false); }
  };

  const inputCls = "mt-1 w-full h-11 px-3 rounded-xl sm:rounded-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white";

  return (
    <div className="max-w-2xl mx-auto pb-20" data-testid="mission-create-page">
      <UpgradeModal open={!!upgrade} onClose={()=>{setUpgrade(null); nav("/app/missions");}} message={upgrade}/>
      <div className="text-[11px] sm:text-xs uppercase tracking-[0.16em] text-blue-700 font-bold">Nouvelle mission</div>
      <h1 ref={heading} tabIndex={-1} className="mt-2 text-3xl font-display font-bold tracking-tight outline-none">{["Commençons par votre mission", "De quelle équipe avez-vous besoin ?", "Votre mission est prête à être créée"][step]}</h1>
      <p className="mt-3 text-sm text-gray-600">{["Un nom et un lieu pour commencer. WhatsApp viendra ensuite.", "Précisez quand et combien de personnes vous souhaitez mobiliser.", "Vérifiez les informations. Vous choisirez ensuite les intervenants."][step]}</p>
      <ol className="mt-5 flex gap-2 text-xs" aria-label="Étapes de création">{["Mission", "Créneau", "Vérification"].map((label, index) => <li key={label} aria-current={step === index ? "step" : undefined} className={`flex-1 border-t-4 pt-2 ${index <= step ? "border-blue-600 text-blue-700 font-semibold" : "border-gray-200 text-gray-500"}`}>{index + 1}. {label}</li>)}</ol>
      <form onSubmit={submit} className="mt-5 sm:mt-8 space-y-4 sm:space-y-6">
        {step === 0 && <>
        <div className="bg-white rounded-2xl sm:rounded-xl border border-gray-200 p-4 sm:p-8 space-y-5">
          <h2 className="font-display font-bold text-lg">Les informations essentielles</h2>
          <div>
            <label htmlFor="mc-name" className="text-sm font-medium text-gray-700">Nom de la mission *</label>
                  <input required id="mc-name" data-testid="mc-name" className={inputCls} value={mission.name} onChange={(e)=>setM("name", e.target.value)} placeholder="Montage Salon Nike"/>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="mc-location" className="text-sm font-medium text-gray-700">Lieu *</label>
                  <input required id="mc-location" data-testid="mc-location" className={inputCls} value={mission.location} onChange={(e)=>setM("location", e.target.value)} placeholder="Lille Grand Palais"/>
            </div>
          </div>
          <details><summary className="cursor-pointer text-sm text-blue-700 py-2">Ajouter une adresse ou des précisions (facultatif)</summary>
            <label className="block mt-3 text-sm">Adresse<input data-testid="mc-address" className={inputCls} value={mission.address} onChange={e => setM("address", e.target.value)} /></label>
            <label className="block mt-3 text-sm">Description<textarea data-testid="mc-desc" className={inputCls} value={mission.description} onChange={e => setM("description", e.target.value)} /></label>
          </details>

        </div>

        </>}
        {step === 1 && <>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="font-display font-bold text-lg">Créneaux</h2>
            <button type="button" onClick={addShift} data-testid="mc-add-shift" className="inline-flex items-center gap-2 text-sm bg-white border border-gray-300 hover:bg-gray-50 px-3 py-2 rounded-xl sm:rounded-md">
              <Plus className="w-4 h-4"/> Ajouter un créneau
            </button>
          </div>
          {shifts.map((s, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6 space-y-4" data-testid={`mc-shift-${i}`}>
              <div className="flex items-center justify-between">
                <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Créneau {i + 1}</div>
                {shifts.length > 1 && (
                  <button type="button" onClick={()=>removeShift(i)} data-testid={`mc-remove-shift-${i}`} className="p-1.5 rounded hover:bg-red-50 text-red-600">
                    <Trash2 className="w-4 h-4"/>
                  </button>
                )}
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor={`mc-shift-${i}-date`} className="text-sm font-medium text-gray-700">Date *</label>
                  <input type="date" required min={todayStr} id={`mc-shift-${i}-date`} data-testid={`mc-shift-${i}-date`} className={inputCls} value={s.date} onChange={(e)=>setS(i, "date", e.target.value)}/>
                </div>
                <div>
                  <label htmlFor={`mc-shift-${i}-start`} className="text-sm font-medium text-gray-700">Début *</label>
                  <input type="time" required id={`mc-shift-${i}-start`} data-testid={`mc-shift-${i}-start`} className={inputCls} value={s.start_time} onChange={(e)=>setS(i, "start_time", e.target.value)}/>
                </div>
                <div>
                  <label htmlFor={`mc-shift-${i}-end`} className="text-sm font-medium text-gray-700">Fin *</label>
                  <input type="time" required id={`mc-shift-${i}-end`} data-testid={`mc-shift-${i}-end`} className={inputCls} value={s.end_time} onChange={(e)=>setS(i, "end_time", e.target.value)}/>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label htmlFor={`mc-shift-${i}-people`} className="text-sm font-medium text-gray-700">Personnes *</label>
                  <input type="number" min="1" required id={`mc-shift-${i}-people`} data-testid={`mc-shift-${i}-people`} className={inputCls} value={s.people_needed} onChange={(e)=>setS(i, "people_needed", e.target.value)}/>
                </div>
                <div>
                  <label htmlFor={`mc-shift-${i}-rate`} className="text-sm font-medium text-gray-700">Tarif horaire (€/h) *</label>
                  <input type="number" min="0" step="0.5" required id={`mc-shift-${i}-rate`} data-testid={`mc-shift-${i}-rate`} className={inputCls} value={s.rate_hourly} onChange={(e)=>setS(i, "rate_hourly", e.target.value)}/>
                </div>
                <div>
                  <label htmlFor={`mc-shift-${i}-type`} className="text-sm font-medium text-gray-700">Type</label>
                  <select id={`mc-shift-${i}-type`} data-testid={`mc-shift-${i}-type`} className={inputCls} value={s.mission_type} onChange={(e)=>setS(i, "mission_type", e.target.value)}>
                    {TYPES.map(t => <option key={t.v} value={t.v}>{t.l}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor={`mc-shift-${i}-skill`} className="text-sm font-medium text-gray-700">Compétence requise</label>
                  <input id={`mc-shift-${i}-skill`} data-testid={`mc-shift-${i}-skill`} className={inputCls} value={s.skill_required} onChange={(e)=>setS(i, "skill_required", e.target.value)} placeholder="ex: technique"/>
                </div>
                <div>
                  <label htmlFor={`mc-shift-${i}-desc`} className="text-sm font-medium text-gray-700">Consignes du shift</label>
                  <input id={`mc-shift-${i}-desc`} data-testid={`mc-shift-${i}-desc`} className={inputCls} value={s.description} onChange={(e)=>setS(i, "description", e.target.value)} placeholder="Point de RDV, tenue, etc."/>
                </div>
              </div>
              <div className="text-xs text-gray-500 border-t border-gray-100 pt-3" data-testid={`mc-shift-${i}-estimate`}>
                Estimation coût brut : <span className="font-semibold text-gray-900">{estimate(s)} €</span>
                <span className="text-gray-400"> ({s.people_needed} pers. × {s.rate_hourly}€/h)</span>
              </div>
            </div>
          ))}
        </div>

        </>}
        {step === 2 && <section className="bg-white rounded-2xl border border-gray-200 p-5 space-y-4" aria-label="Récapitulatif">
          <h2 className="text-xl font-semibold break-words">{mission.name}</h2><p className="text-gray-600 break-words">{mission.location}{mission.address && ` · ${mission.address}`}</p>
          {shifts.map((s, i) => <div key={i} className="border-t pt-3 text-sm leading-relaxed"><strong>Créneau {i + 1} · {s.date.split("-").reverse().join("/")}</strong><p>{s.start_time} – {s.end_time} · {s.people_needed} personne(s) · {s.rate_hourly} €/h</p><p>{TYPES.find(t => t.v === s.mission_type)?.l}{s.skill_required && ` · ${s.skill_required}`}</p>{s.description && <p>{s.description}</p>}</div>)}
          <label className="flex items-center gap-3 bg-blue-50 border border-blue-100 rounded-xl sm:rounded-md px-4 py-3">
            <input type="checkbox" data-testid="mc-cascade" checked={mission.cascade_enabled} onChange={(e)=>setM("cascade_enabled", e.target.checked)} className="w-4 h-4 accent-blue-600"/>
            <div>
              <div className="text-sm font-medium text-gray-900">Cascade automatique</div>
              <div className="text-xs text-gray-600">En cas de refus ou absence, contacter automatiquement le prochain intervenant pour chaque shift.</div>
            </div>
          </label>
          <p className="text-sm text-gray-600">Aucune demande ne part à la création. Vous choisirez vos contacts et vérifierez le message avant de confirmer l’envoi.</p>
          <p className="text-xs text-gray-500">Créer cette mission utilise une mission offerte ou un crédit disponible. Aucun paiement automatique. Les créneaux de ce même événement sont inclus.</p>
        </section>}
        {error && <div role="alert" className="text-sm text-red-600" data-testid="mc-error">{error}</div>}
        <div className="flex justify-end gap-3">
          <button type="button" disabled={loading} onClick={()=>{ setError(""); step > 0 ? setStep(step - 1) : nav("/app/dashboard"); }} className="px-4 py-2.5 rounded-xl sm:rounded-md border border-gray-300 text-gray-700 hover:bg-gray-50">{step > 0 ? "Retour" : "Annuler"}</button>
          <button type="submit" disabled={loading} data-testid="mc-submit" className="px-5 py-2.5 rounded-xl sm:rounded-md bg-blue-600 hover:bg-blue-700 text-white font-medium disabled:opacity-60">
            {loading ? "Création…" : step === 2 ? "Créer ma mission" : "Continuer"}
          </button>
        </div>
      </form>
    </div>
  );
}

