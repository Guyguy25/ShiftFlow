import React, { useState } from "react";
import { api, formatApiError } from "../lib/api";
import { toast } from "sonner";
import ShiftFields from "./ShiftFields";

export default function ShiftEditor({ missionId, shift, onSaved, onCancel }) {
  const [form, setForm] = useState(() => ({ date: shift?.date || "", start_time: shift?.start_time || "09:00", end_time: shift?.end_time || "18:00", people_needed: shift?.people_needed || 1, rate_hourly: shift?.rate_hourly ?? 0, fixed_amount: shift?.fixed_amount ?? 0, pay_type: shift?.pay_type || "hourly", pay_basis: shift?.pay_basis || "unspecified", mission_type: shift?.mission_type || "montage", description: shift?.description || "", skill_required: shift?.skill_required || "" }));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const change = (name, value) => setForm(prev => ({ ...prev, [name]: value }));
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
  return <form onSubmit={submit} className="m-3 rounded-2xl border border-blue-200 bg-white p-4 sm:m-4 sm:p-5" aria-label={shift ? "Modifier le créneau" : "Ajouter un créneau"}>
    <h3 className="font-display text-lg font-bold">{shift ? "Modifier le créneau" : "Ajouter un créneau"}</h3>
    {shift && <p className="mt-2 text-sm text-gray-600">Les intervenants contactés et confirmés seront prévenus des changements. Les confirmations restent conservées.</p>}
    <fieldset disabled={saving} className="mt-4 min-w-0">
      <ShiftFields value={form} idPrefix={shift ? "edit-shift" : "new-shift"} onChange={change} />
    </fieldset>
    {error && <p role="alert" className="mt-3 text-red-700 text-sm">{error}</p>}
    <button disabled={saving} className="mt-4 min-h-11 rounded-lg bg-blue-600 text-white px-4">{saving ? "Enregistrement…" : shift ? "Enregistrer et notifier" : "Ajouter"}</button>
    <button type="button" disabled={saving} className="ml-3 min-h-11" onClick={onCancel}>Annuler</button>
  </form>;
}
