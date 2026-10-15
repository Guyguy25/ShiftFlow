import React, { useState } from "react";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";

export default function ShiftEditor({ missionId, shift, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({ date: shift?.date || "", start_time: shift?.start_time || "09:00", end_time: shift?.end_time || "18:00", people_needed: shift?.people_needed || 1, rate_hourly: shift?.rate_hourly ?? 0, fixed_amount: shift?.fixed_amount ?? 0, pay_type: shift?.pay_type || "hourly", pay_basis: shift?.pay_basis || "unspecified", mission_type: shift?.mission_type || "montage", description: shift?.description || "", skill_required: shift?.skill_required || "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = event => setForm(prev => ({ ...prev, [event.target.name]: event.target.value }));
  const submit = async event => {
    event.preventDefault(); if (saving) return;
    setSaving(true); setError("");
    try {
      const payload = { ...form, people_needed: Number(form.people_needed), rate_hourly: Number(form.rate_hourly), fixed_amount: Number(form.fixed_amount) };
      const { data } = shift ? await api.put(`/shifts/${shift.id}`, payload) : await api.post(`/missions/${missionId}/shifts`, payload);
      if (data.notifications?.failed) toast.error("Créneau enregistré. Des notifications ont échoué : reconnectez WhatsApp puis réessayez les notifications.");
      else toast.success("Créneau enregistré");
      onSaved();
    } catch (err) { setError(formatApiError(err.response?.data?.detail) || "Enregistrement impossible"); }
    finally { setSaving(false); }
  };
  const field = (name, label, type, props = {}) => <label className="block text-sm">{label}<input className="mt-1 w-full border rounded-lg p-3" name={name} value={form[name]} type={type} onChange={change} required {...props} /></label>;
  return <form onSubmit={submit} className="m-4 rounded-xl border border-blue-200 bg-blue-50 p-4" aria-label={shift ? "Modifier le créneau" : "Ajouter un créneau"}>
    <h3 className="font-semibold">{shift ? "Modifier le créneau" : "Ajouter un créneau"}</h3>
    {shift && <p className="mt-2 text-sm">Les intervenants contactés et confirmés seront prévenus des changements. Les confirmations restent conservées.</p>}
    <fieldset disabled={saving} className="mt-3 grid sm:grid-cols-2 gap-3">
      {field("date", "Date", "date")}{field("people_needed", "Nombre de personnes", "number", { min: 1, step: 1 })}
      {field("start_time", "Début", "time")}{field("end_time", "Fin", "time")}
      <label className="text-sm">Rémunération<select className="mt-1 w-full border rounded-lg p-3" name="pay_type" value={form.pay_type} onChange={change}><option value="hourly">Tarif horaire</option><option value="fixed">Cachet fixe par personne et créneau</option></select></label>
      {form.pay_type === "fixed" ? field("fixed_amount", "Montant du cachet (€)", "number", { min: 0, step: "0.01" }) : field("rate_hourly", "Tarif horaire (€)", "number", { min: 0, step: "0.01" })}
      <label className="text-sm">Brut ou net<select className="mt-1 w-full border rounded-lg p-3" name="pay_basis" value={form.pay_basis} onChange={change}><option value="unspecified">{form.pay_type === "fixed" ? "Choisir brut ou net" : "Non précisé"}</option><option value="gross">Brut</option><option value="net">Net</option></select></label>
      <label className="text-sm">Type<select className="mt-1 w-full border rounded-lg p-3" name="mission_type" value={form.mission_type} onChange={change}>{["montage", "demontage", "montage_demontage", "technique", "autre"].map(type => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}</select></label>
      <label className="sm:col-span-2 text-sm">Description<textarea className="mt-1 w-full border rounded-lg p-3" name="description" value={form.description} onChange={change} /></label>
    </fieldset>
    {error && <p role="alert" className="mt-3 text-red-700 text-sm">{error}</p>}
    <button disabled={saving} className="mt-4 min-h-11 rounded-lg bg-blue-600 text-white px-4">{saving ? "Enregistrement…" : shift ? "Enregistrer et notifier" : "Ajouter"}</button>
    <button type="button" disabled={saving} className="ml-3 min-h-11" onClick={onCancel}>Annuler</button>
  </form>;
}
