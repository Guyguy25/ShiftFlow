import React, { useEffect, useState } from "react";
import { Clock3, Save } from "lucide-react";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

export default function TimesheetAutomationSettings() {
  const [settings, setSettings] = useState(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    let mounted = true;
    api.get("/timesheets/settings").then(({ data }) => { if (mounted) setSettings(data); })
      .catch(() => toast.error("Impossible de charger le suivi des heures."));
    return () => { mounted = false; };
  }, []);
  const save = async () => {
    setSaving(true);
    try {
      const { data } = await api.put("/timesheets/settings", settings);
      setSettings(data);
      toast.success("Paramètres du suivi des heures enregistrés.");
    } catch (err) {
      toast.error(formatApiError(err.response?.data?.detail) || "Enregistrement impossible.");
    } finally { setSaving(false); }
  };
  return <section className="rounded-xl border border-gray-200 bg-white p-5 sm:p-6" data-testid="timesheet-automation-settings">
    <div className="flex items-center gap-2"><Clock3 size={20} className="text-blue-700"/><h2 className="font-display text-lg font-bold">Déclaration des heures</h2></div>
    <p className="mt-2 text-sm text-gray-600">Après la fin de chaque créneau, les intervenants confirmés peuvent recevoir un lien WhatsApp pour déclarer leurs heures sans créer de compte. Vous validez ensuite les déclarations dans Suivi des heures.</p>
    {!settings ? <p className="mt-4 text-sm text-gray-500">Chargement…</p> : <>
      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={settings.auto_send} onChange={e => setSettings({ ...settings, auto_send: e.target.checked })} className="mt-1 h-4 w-4 accent-blue-600"/>
        <span><strong>Envoyer automatiquement à la fin du créneau</strong><span className="mt-1 block text-gray-500">Désactivé par défaut. Ne concerne que les prochains créneaux terminés après activation.</span></span>
      </label>
      <label className="mt-5 flex cursor-pointer items-start gap-3 text-sm">
        <input type="checkbox" checked={settings.reminder_enabled} onChange={e => setSettings({ ...settings, reminder_enabled: e.target.checked })} className="mt-1 h-4 w-4 accent-blue-600"/>
        <span><strong>Relancer une seule fois les déclarations non reçues</strong><span className="mt-1 block text-gray-500">Les heures déjà déclarées ou validées ne sont pas relancées.</span></span>
      </label>
      <label htmlFor="timesheet-reminder" className="mt-5 block text-sm font-medium">Délai avant relance</label>
      <select id="timesheet-reminder" disabled={!settings.reminder_enabled} value={settings.reminder_after_hours}
        onChange={e => setSettings({ ...settings, reminder_after_hours: Number(e.target.value) })}
        className="mt-2 w-full max-w-xs min-h-11 rounded-lg border border-gray-300 px-3 text-sm">
        <option value={12}>12 heures</option><option value={24}>24 heures</option><option value={48}>48 heures</option>
      </select>
      <div className="mt-5">
        <button type="button" disabled={saving} onClick={save} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"><Save size={16}/>{saving ? "Enregistrement…" : "Enregistrer ces réglages"}</button>
      </div>
      <p className="mt-3 text-xs text-gray-500">L'envoi dépend de votre connexion WhatsApp et de l'exécution de la tâche planifiée déjà utilisée pour les rappels. Vous pouvez aussi demander les heures manuellement depuis chaque mission.</p>
    </>}
  </section>;
}
