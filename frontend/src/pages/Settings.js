import React, { useEffect, useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Sparkles, Send, CheckCircle2, AlertCircle } from "lucide-react";
import { api } from "../lib/api";

export default function Settings() {
  const { user } = useAuth();
  const [cfg, setCfg] = useState(null);
  const [notifs, setNotifs] = useState([]);

  useEffect(() => {
    api.get("/config").then((r) => setCfg(r.data)).catch(() => {});
    api.get("/notifications/recent").then((r) => setNotifs(r.data)).catch(() => {});
  }, []);

  return (
    <div data-testid="settings-page">
      <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Paramètres</div>
      <h1 className="mt-2 text-3xl font-display font-bold tracking-tight">Compte & Agence</h1>

      <div className="mt-8 grid gap-6 max-w-3xl">
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <h2 className="font-display font-bold text-lg">Informations</h2>
          <dl className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
            <div><dt className="text-gray-500">Agence</dt><dd className="font-medium text-gray-900" data-testid="settings-agency">{user?.agency_name}</dd></div>
            <div><dt className="text-gray-500">Responsable</dt><dd className="font-medium text-gray-900" data-testid="settings-name">{user?.name}</dd></div>
            <div><dt className="text-gray-500">Email</dt><dd className="font-medium text-gray-900" data-testid="settings-email">{user?.email}</dd></div>
            <div><dt className="text-gray-500">Téléphone</dt><dd className="font-medium text-gray-900" data-testid="settings-phone">{user?.phone || "—"}</dd></div>
          </dl>
        </div>

        <div className={`rounded-xl border p-6 ${cfg?.twilio_ready ? "bg-green-50 border-green-200" : "bg-amber-50 border-amber-200"}`} data-testid="settings-twilio-block">
          <div className="flex items-center gap-2 font-semibold">
            <Send className="w-5 h-5"/>
            Notifications SMS (Twilio)
            {cfg?.twilio_ready ? (
              <span className="ml-auto text-xs px-2 py-1 rounded-md bg-green-600 text-white inline-flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Actif</span>
            ) : (
              <span className="ml-auto text-xs px-2 py-1 rounded-md bg-amber-600 text-white inline-flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Non configuré</span>
            )}
          </div>
          <div className="mt-3 text-sm text-gray-700">
            {cfg?.twilio_ready ? (
              <>Les intervenants reçoivent automatiquement leur lien par SMS depuis <strong>{cfg.twilio_from}</strong>.</>
            ) : (
              <>Twilio SID + Auth Token sont configurés, mais il manque le numéro d'envoi <code className="text-xs bg-white px-1 rounded">TWILIO_PHONE_NUMBER</code>. Ajoutez-le dans <code className="text-xs bg-white px-1 rounded">/app/backend/.env</code> puis redémarrez le backend.</>
            )}
          </div>
          <div className="mt-3 text-xs text-gray-500">
            Format destinataires : E.164. Un numéro français commençant par <code>06</code> est automatiquement converti en <code>{cfg?.default_country_code}6…</code>.
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-xl p-6" data-testid="settings-notif-log">
          <h2 className="font-display font-bold text-lg">Journal SMS (30 derniers)</h2>
          {notifs.length === 0 ? (
            <div className="mt-4 text-sm text-gray-500">Aucun SMS envoyé pour le moment.</div>
          ) : (
            <ul className="mt-4 divide-y divide-gray-100">
              {notifs.map((n) => (
                <li key={n.id} className="py-3 text-sm flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-gray-900">→ {n.to || "n/a"} <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${n.channel === "sms" ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-700"}`}>{n.channel}</span></div>
                    <div className="text-xs text-gray-500 truncate max-w-lg">{n.body}</div>
                    {n.error && <div className="text-xs text-red-600 mt-0.5">{n.error}</div>}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">{new Date(n.sent_at).toLocaleString("fr-FR")} · {n.status}</div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="bg-gradient-to-br from-blue-50 to-white border border-blue-100 rounded-xl p-6">
          <div className="flex items-center gap-2 text-blue-700 font-semibold text-sm">
            <Sparkles className="w-4 h-4"/> AI Risk Alert — Bientôt
          </div>
          <p className="mt-2 text-sm text-gray-600">
            L'IA analysera automatiquement vos missions et vous alertera en cas de risque d'équipe incomplète.
          </p>
        </div>
      </div>
    </div>
  );
}
