import React, { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { CalendarClock, MapPin, Euro, CheckCircle2, XCircle, Zap, AlertTriangle, Hammer } from "lucide-react";
import { api, formatApiError } from "../lib/api";

const REFUSE_REASONS = ["Indisponible", "Horaires", "Lieu", "Autre"];

const TYPE_LABEL = {
  montage: "Montage",
  demontage: "Démontage",
  montage_demontage: "Montage + Démontage",
  technique: "Technique / régie",
  autre: "Autre",
};

export default function PublicConfirm() {
  const { token } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [action, setAction] = useState(null);
  const [showRefuse, setShowRefuse] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const { data } = await api.get(`/public/mission/${token}`);
      setData(data);
      if (["confirmed", "refused", "cancelled"].includes(data.slot.status)) setAction(data.slot.status);
    } catch (err) {
      setError(formatApiError(err.response?.data?.detail) || "Lien invalide");
    }
  };
  useEffect(() => { load(); }, [token]);

  const accept = async () => {
    setLoading(true);
    try {
      const { data: r } = await api.post(`/public/mission/${token}/accept`);
      if (r.status === "confirmed") setAction("confirmed");
      else setError(r.reason || "Impossible de confirmer");
      await load();
    } catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };
  const refuse = async () => {
    setLoading(true);
    try {
      await api.post(`/public/mission/${token}/refuse`, { reason });
      setAction("refused");
      await load();
    } catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { setLoading(false); setShowRefuse(false); }
  };
  const cancelConfirmation = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler cette mission ?")) return;
    setLoading(true);
    try {
      await api.post(`/public/mission/${token}/cancel-confirmation`);
      setAction("cancelled");
      await load();
    } catch (err) { setError(formatApiError(err.response?.data?.detail)); }
    finally { setLoading(false); }
  };

  if (error && !data) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center px-6">
        <div className="max-w-md text-center" data-testid="public-error">
          <AlertTriangle className="w-12 h-12 text-red-500 mx-auto"/>
          <h1 className="mt-4 text-2xl font-display font-bold">Lien invalide</h1>
          <p className="mt-2 text-gray-600">{error}</p>
        </div>
      </div>
    );
  }
  if (!data) return <div className="min-h-screen flex items-center justify-center text-gray-500">Chargement…</div>;

  const { mission, shift, worker, agency } = data;

  return (
    <div className="min-h-screen bg-[#F9FAFB] flex flex-col">
      <header className="bg-white border-b border-gray-200 px-6 py-4 flex items-center gap-2">
        <div className="w-7 h-7 rounded-md bg-blue-600 flex items-center justify-center">
          <Zap className="w-4 h-4 text-white"/>
        </div>
        <span className="font-display font-bold">ShiftFlow</span>
        <span className="ml-auto text-xs text-gray-500 truncate">{agency.name}</span>
      </header>

      <main className="flex-1 max-w-lg w-full mx-auto px-6 py-8" data-testid="public-confirm-page">
        <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Mission</div>
        <h1 className="mt-2 text-3xl sm:text-4xl font-display font-bold tracking-tight" data-testid="public-mission-name">{mission.name}</h1>
        <p className="mt-2 text-gray-600">Bonjour <span className="font-medium">{worker.first_name}</span>, êtes-vous disponible pour ce shift ?</p>

        <div className="mt-6 bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <div className="flex items-center gap-3">
            <CalendarClock className="w-5 h-5 text-gray-400"/>
            <div>
              <div className="text-xs uppercase text-gray-500 tracking-widest">Date & horaires</div>
              <div className="font-medium text-gray-900" data-testid="public-shift-date">{shift.date} · {shift.start_time} → {shift.end_time}</div>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-gray-400 mt-0.5"/>
            <div>
              <div className="text-xs uppercase text-gray-500 tracking-widest">Lieu</div>
              <div className="font-medium text-gray-900">{mission.location}</div>
              {mission.address && <div className="text-sm text-gray-500">{mission.address}</div>}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Euro className="w-5 h-5 text-gray-400"/>
            <div>
              <div className="text-xs uppercase text-gray-500 tracking-widest">Rémunération</div>
              <div className="font-medium text-gray-900" data-testid="public-shift-rate">{shift.rate_hourly} €/h</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Hammer className="w-5 h-5 text-gray-400"/>
            <div>
              <div className="text-xs uppercase text-gray-500 tracking-widest">Type</div>
              <div className="font-medium text-gray-900">{TYPE_LABEL[shift.mission_type]}</div>
            </div>
          </div>
          {shift.description && (
            <>
              <div className="text-xs uppercase text-gray-500 tracking-widest">Consignes</div>
              <div className="-mt-2 text-sm text-gray-700 whitespace-pre-line">{shift.description}</div>
            </>
          )}
        </div>

        {action === "confirmed" && (
          <div className="mt-8 text-center" data-testid="public-accepted">
            <CheckCircle2 className="w-16 h-16 text-green-600 mx-auto"/>
            <h2 className="mt-4 text-2xl font-display font-bold">Mission confirmée ✅</h2>
            <p className="mt-2 text-gray-600">Merci {worker.first_name}, à bientôt sur place !</p>
            <button onClick={cancelConfirmation} disabled={loading} data-testid="public-cancel-btn" className="mt-6 text-sm text-red-600 hover:text-red-700 underline">
              Je dois finalement annuler
            </button>
          </div>
        )}
        {action === "refused" && (
          <div className="mt-8 text-center" data-testid="public-refused">
            <XCircle className="w-16 h-16 text-gray-400 mx-auto"/>
            <h2 className="mt-4 text-2xl font-display font-bold">Merci pour votre réponse.</h2>
            <p className="mt-2 text-gray-600">À très vite pour une prochaine mission.</p>
          </div>
        )}
        {action === "cancelled" && (
          <div className="mt-8 text-center" data-testid="public-cancelled">
            <XCircle className="w-16 h-16 text-gray-400 mx-auto"/>
            <h2 className="mt-4 text-2xl font-display font-bold">Réponse enregistrée.</h2>
            <p className="mt-2 text-gray-600">Nous vous recontacterons pour une prochaine mission.</p>
          </div>
        )}

        {!action && !showRefuse && (
          <div className="mt-8 space-y-3" data-testid="public-actions">
            <button onClick={accept} disabled={loading} data-testid="public-accept-btn"
              className="w-full h-20 rounded-xl bg-green-600 hover:bg-green-700 text-white text-2xl font-display font-bold tracking-tight transition-colors flex items-center justify-center gap-3 shadow-[0_10px_30px_rgba(22,163,74,0.25)]">
              <CheckCircle2 className="w-7 h-7"/> J'ACCEPTE
            </button>
            <button onClick={()=>setShowRefuse(true)} disabled={loading} data-testid="public-refuse-btn"
              className="w-full h-20 rounded-xl bg-white border-2 border-red-500 text-red-600 hover:bg-red-50 text-2xl font-display font-bold tracking-tight transition-colors flex items-center justify-center gap-3">
              <XCircle className="w-7 h-7"/> JE REFUSE
            </button>
          </div>
        )}

        {showRefuse && !action && (
          <div className="mt-8 bg-white border border-gray-200 rounded-xl p-5" data-testid="public-refuse-form">
            <div className="font-medium">Pourquoi ne pouvez-vous pas venir ? (facultatif)</div>
            <div className="mt-4 space-y-2">
              {REFUSE_REASONS.map(r => (
                <label key={r} className="flex items-center gap-3 p-3 rounded-md border border-gray-200 cursor-pointer hover:bg-gray-50">
                  <input type="radio" name="reason" value={r} checked={reason===r} onChange={(e)=>setReason(e.target.value)} className="w-4 h-4 accent-blue-600"/>
                  <span>{r}</span>
                </label>
              ))}
            </div>
            <div className="mt-4 flex gap-3">
              <button onClick={()=>setShowRefuse(false)} className="flex-1 py-3 rounded-md border border-gray-300">Retour</button>
              <button onClick={refuse} disabled={loading} data-testid="public-confirm-refuse" className="flex-1 py-3 rounded-md bg-red-600 hover:bg-red-700 text-white font-medium disabled:opacity-60">
                {loading ? "Envoi…" : "Confirmer mon refus"}
              </button>
            </div>
          </div>
        )}
        {error && <div className="mt-4 text-sm text-red-600 text-center">{error}</div>}
      </main>
    </div>
  );
}
