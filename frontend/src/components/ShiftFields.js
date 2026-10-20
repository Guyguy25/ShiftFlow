import React from "react";
import { CalendarDays, Users, Euro, SlidersHorizontal } from "lucide-react";

export const MAX_CREW = 500;

export const SHIFT_TYPES = [
  { value: "montage", label: "Montage" },
  { value: "demontage", label: "Démontage" },
  { value: "montage_demontage", label: "Montage + démontage" },
  { value: "technique", label: "Technique / régie" },
  { value: "autre", label: "Autre" },
];

const fieldClass = "mt-2 h-12 w-full min-w-0 rounded-xl border border-gray-200 bg-white px-3.5 text-sm text-gray-950 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100";
const cardClass = "rounded-2xl border border-gray-200 bg-gray-50/70 p-4 sm:p-5";
const choiceClass = (active) => "min-h-11 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 " + (active ? "border-blue-600 bg-blue-600 text-white shadow-sm" : "border-gray-200 bg-white text-gray-700 hover:border-blue-300 hover:bg-blue-50");
const amountFormat = (amount) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 2 }).format(amount);

export function estimatedPay(shift) {
  const amount = Number(shift.pay_type === "fixed" ? shift.fixed_amount : shift.rate_hourly);
  const people = Number(shift.people_needed);
  if (!Number.isFinite(amount) || amount < 0 || !Number.isInteger(people) || people < 1 || people > MAX_CREW) return null;
  if (shift.pay_type === "fixed") return amount * people;
  if (!shift.start_time || !shift.end_time) return null;
  const [startHour, startMinute] = shift.start_time.split(":").map(Number);
  const [endHour, endMinute] = shift.end_time.split(":").map(Number);
  if (![startHour, startMinute, endHour, endMinute].every(Number.isFinite)) return null;
  let duration = (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60;
  if (duration <= 0) duration += 24;
  if (shift.end_date && shift.date) {
    const days = (Date.parse(shift.end_date) - Date.parse(shift.date)) / 86400000;
    duration = days * 24 + (endHour * 60 + endMinute - startHour * 60 - startMinute) / 60;
  }
  duration -= Number(shift.break_minutes || 0) / 60;
  if (duration <= 0 || duration > 744) return null;
  return duration * amount * people;
}

/** The same inputs are used when creating a mission and editing an existing shift. */
export default function ShiftFields({ value, onChange, idPrefix = "shift", minDate }) {
  const count = Number(value.people_needed);
  const validCount = Number.isInteger(count) && count >= 1 && count <= MAX_CREW;
  const shownCount = validCount ? count : 1;
  const sliderMax = Math.max(30, Math.ceil(shownCount / 10) * 10);
  const fixed = value.pay_type === "fixed";
  const payAmountKey = fixed ? "fixed_amount" : "rate_hourly";
  const payAmount = value[payAmountKey] ?? "";
  const payBasis = value.pay_basis || "unspecified";
  const sum = estimatedPay(value);
  const setCount = (number) => onChange("people_needed", number);
  const groupLabel = (title, Icon) => <div className="mb-4 flex items-center gap-2"><Icon className="h-4 w-4 text-blue-600" aria-hidden="true" /><h3 className="font-display text-base font-bold text-gray-950">{title}</h3></div>;

  return <div className="space-y-4">
    <section className={cardClass} aria-label="Date et horaires">
      {groupLabel("Quand ?", CalendarDays)}
      <div className="grid gap-3 sm:grid-cols-2 mb-3">
        <label className="text-sm">Date de fin (facultative pour une nuit)
          <input type="date" min={value.date || minDate} className={fieldClass} value={value.end_date || ""} onChange={e => onChange("end_date", e.target.value || null)} />
        </label>
        <label className="text-sm">Pause non rémunérée (minutes)
          <input type="number" min="0" max="44639" step="1" className={fieldClass} value={value.break_minutes || 0} onChange={e => onChange("break_minutes", Number(e.target.value))} />
        </label>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <label className="block text-sm font-medium text-gray-700" htmlFor={idPrefix + "-date"}>Date <span className="text-blue-700">*</span>
          <input type="date" required min={minDate} id={idPrefix + "-date"} data-testid={idPrefix + "-date"} data-onboarding={!value.date || (minDate && value.date < minDate) ? "date" : undefined} className={fieldClass} value={value.date || ""} onChange={(event) => onChange("date", event.target.value)} />
        </label>
        <label className="block text-sm font-medium text-gray-700" htmlFor={idPrefix + "-start"}>Début <span className="text-blue-700">*</span>
          <input type="time" required id={idPrefix + "-start"} data-testid={idPrefix + "-start"} data-onboarding={value.date && !value.start_time ? "hours" : undefined} className={fieldClass} value={value.start_time || ""} onChange={(event) => onChange("start_time", event.target.value)} />
        </label>
        <label className="block text-sm font-medium text-gray-700" htmlFor={idPrefix + "-end"}>Fin <span className="text-blue-700">*</span>
          <input type="time" required id={idPrefix + "-end"} data-testid={idPrefix + "-end"} data-onboarding={value.date && value.start_time && !value.end_time ? "hours" : undefined} className={fieldClass} value={value.end_time || ""} onChange={(event) => onChange("end_time", event.target.value)} />
        </label>
      </div>
    </section>

    <section className={cardClass} aria-label="Équipe requise">
      {groupLabel("Combien d'intervenants ?", Users)}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">Choisissez avec le curseur ou saisissez le nombre exact.</p>
        <div className="flex h-12 items-center gap-1 rounded-xl border border-gray-200 bg-white p-1">
          <button type="button" disabled={!validCount || count <= 1} aria-label="Retirer un intervenant" onClick={() => setCount(count - 1)} className="h-10 w-10 rounded-lg text-xl font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-300">−</button>
          <input type="number" min="1" max={MAX_CREW} step="1" inputMode="numeric" required id={idPrefix + "-people"} data-testid={idPrefix + "-people"} data-onboarding={value.date && value.start_time && value.end_time ? "needs" : undefined} aria-label="Nombre d'intervenants" className="h-10 w-16 rounded-md border-0 bg-transparent text-center text-lg font-bold text-gray-950 outline-none focus:ring-2 focus:ring-blue-400" value={value.people_needed ?? ""} onChange={(event) => setCount(event.target.value)} />
          <button type="button" disabled={!validCount || count >= MAX_CREW} aria-label="Ajouter un intervenant" onClick={() => setCount(count + 1)} className="h-10 w-10 rounded-lg text-xl font-semibold text-blue-700 hover:bg-blue-50 disabled:cursor-not-allowed disabled:text-gray-300">+</button>
        </div>
      </div>
      <label className="mt-5 block text-xs font-semibold uppercase tracking-wider text-gray-500" htmlFor={idPrefix + "-people-slider"}>Nombre d'intervenants</label>
      <input type="range" min="1" max={sliderMax} step="1" id={idPrefix + "-people-slider"} data-testid={idPrefix + "-people-slider"} aria-label="Ajuster le nombre d'intervenants" className="mt-2 h-3 w-full cursor-pointer accent-blue-600" value={shownCount} onChange={(event) => setCount(Number(event.target.value))} />
      <div className="mt-1 flex justify-between text-xs text-gray-500"><span>1 personne</span><span>{sliderMax} personnes · jusqu'à {MAX_CREW} par saisie</span></div>
    </section>

    <section className={cardClass} aria-label="Rémunération">
      {groupLabel("Rémunération par intervenant", Euro)}
      <div className="grid grid-cols-2 gap-2" role="group" aria-label="Type de rémunération">
        {[["hourly", "À l'heure"], ["fixed", "Au cachet"]].map(([key, label]) => <button key={key} type="button" data-testid={idPrefix + "-pay-" + key} aria-pressed={(value.pay_type || "hourly") === key} className={choiceClass((value.pay_type || "hourly") === key)} onClick={() => onChange("pay_type", key)}>{label}</button>)}
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)] sm:items-end">
        <label htmlFor={idPrefix + "-rate"} className="block text-sm font-medium text-gray-700">{fixed ? "Montant du cachet" : "Tarif horaire"} <span className="text-blue-700">*</span>
          <div className="relative">
            <input type="number" min="0" step="0.01" inputMode="decimal" required id={idPrefix + "-rate"} data-testid={idPrefix + "-rate"} aria-label={fixed ? "Montant du cachet en euros" : "Tarif horaire en euros"} value={payAmount} onChange={(event) => onChange(payAmountKey, event.target.value)} className={fieldClass + " pr-20 font-semibold"} />
            <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm font-semibold text-gray-500">{fixed ? "€ / cachet" : "€ / h"}</span>
          </div>
        </label>
        <div>
          <p className="mb-2 text-sm font-medium text-gray-700">Montant exprimé en {fixed ? <span className="text-blue-700">*</span> : null}</p>
          <div className="grid grid-cols-2 gap-2" role="group" aria-label="Brut ou net">
            {[["gross", "Brut"], ["net", "Net"]].map(([key, label]) => <button key={key} type="button" data-testid={idPrefix + "-basis-" + key} aria-pressed={payBasis === key} className={choiceClass(payBasis === key)} onClick={() => onChange("pay_basis", key)}>{label}</button>)}
          </div>
        </div>
      </div>
      {payBasis === "unspecified" && <p className={"mt-3 text-xs " + (fixed ? "font-semibold text-amber-700" : "text-gray-500")}>{fixed ? "Précisez brut ou net pour pouvoir continuer avec un cachet." : "Brut ou net non précisé. Vous pouvez choisir un type de montant."}</p>}
      <p className="mt-3 text-xs text-gray-500">La rémunération indiquée ne comprend pas les cotisations ou les frais de l'employeur.</p>
    </section>

    <section className={cardClass} aria-label="Type de prestation">
      {groupLabel("Type de prestation", SlidersHorizontal)}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3" role="group" aria-label="Choisir le type de prestation">
        {SHIFT_TYPES.map((type) => <button key={type.value} type="button" aria-pressed={value.mission_type === type.value} data-testid={idPrefix + "-type-" + type.value} className={choiceClass(value.mission_type === type.value)} onClick={() => onChange("mission_type", type.value)}>{type.label}</button>)}
      </div>
    </section>

    <details className="rounded-2xl border border-gray-200 bg-white p-4 sm:p-5">
      <summary className="cursor-pointer text-sm font-semibold text-blue-700">Compétences et consignes <span className="font-normal text-gray-500">(facultatif)</span></summary>
      <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
        <label className="block text-sm font-medium text-gray-700" htmlFor={idPrefix + "-skill"}>Compétence requise
          <input id={idPrefix + "-skill"} data-testid={idPrefix + "-skill"} className={fieldClass} value={value.skill_required || ""} onChange={(event) => onChange("skill_required", event.target.value)} placeholder="Ex. : technique son" />
        </label>
        <label className="block text-sm font-medium text-gray-700" htmlFor={idPrefix + "-desc"}>Consignes du créneau
          <textarea id={idPrefix + "-desc"} data-testid={idPrefix + "-desc"} className={fieldClass + " min-h-24 py-3"} value={value.description || ""} onChange={(event) => onChange("description", event.target.value)} placeholder="Point de rendez-vous, tenue..." />
        </label>
      </div>
    </details>

    <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3" data-testid={idPrefix + "-estimate"}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium text-blue-950">Total des rémunérations indicatif</span>
        <span className="shrink-0 text-lg font-bold text-blue-800">{sum === null ? "—" : amountFormat(sum) + " €"}</span>
      </div>
      <p className="mt-1 text-xs text-blue-800">{validCount ? count : "—"} intervenant(s) · {fixed ? "cachet" : "tarif horaire"} · {payBasis === "gross" ? "brut" : payBasis === "net" ? "net" : "brut/net non précisé"}. Hors charges et frais.</p>
    </div>
  </div>;
}
