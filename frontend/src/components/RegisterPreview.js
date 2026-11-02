import React from "react";
import { Check, User, AlertTriangle, MessageCircle, BarChart3, Target } from "lucide-react";

const fmt = value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
const initials = name => (name || "").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase();
const slug = name => (name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

// Aperçu épuré de l'espace qui se remplit au fil des réponses.
// L'estimation n'apparaît qu'une fois le volume renseigné. Décoratif : aria-hidden.
export default function RegisterPreview({ agency, answers, savings, volumeSeen }) {
  const rows = [
    { key: "role", icon: User, label: "Rôle", value: answers.role },
    { key: "biggest_problem", icon: AlertTriangle, label: "Défi principal", value: answers.biggest_problem },
    { key: "channels", icon: MessageCircle, label: "Canaux actuels", value: (answers.channels || []).join(", ") },
    { key: "volume", icon: BarChart3, label: "Volume", value: volumeSeen ? `${fmt(savings.annualEvents)} événements / an · ${fmt(savings.peoplePerMission)} pers.` : "" },
    { key: "priority", icon: Target, label: "Priorité", value: answers.priority },
  ];
  const filled = rows.filter(r => r.value).length + (agency ? 1 : 0);
  return <div className="sf-preview" aria-hidden="true" data-testid="register-preview">
    <div className="w-full max-w-sm">
      <p className="text-center text-xs font-medium text-gray-400">Votre espace se prépare</p>

      <div className="sf-preview-card mt-4">
        <div className="flex items-center gap-3 border-b border-gray-100 p-5">
          {agency
            ? <span key={initials(agency)} className="sf-pop grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-violet-500 text-sm font-bold text-white">{initials(agency)}</span>
            : <span className="h-11 w-11 shrink-0 rounded-xl border-2 border-dashed border-gray-200" />}
          <div className="min-w-0 flex-1">
            {agency ? <p className="truncate font-display text-lg font-bold text-gray-900">{agency}</p> : <span className="sf-skeleton block h-4 w-32" />}
            {agency ? <p className="mt-0.5 truncate text-xs text-gray-400">app.shiftflow.io/{slug(agency)}</p> : <span className="sf-skeleton mt-2 block h-3 w-44" />}
          </div>
        </div>

        <ul className="divide-y divide-gray-50 px-5 py-2">
          {rows.map(({ key, icon: Icon, label, value }) => <li key={key} className="flex items-start gap-3 py-3">
            <span className={`mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-full transition-colors duration-300 ${value ? "bg-blue-50 text-blue-600" : "bg-gray-50 text-gray-300"}`}>{value ? <Check size={13} strokeWidth={3} /> : <Icon size={13} />}</span>
            <div className="min-w-0 flex-1">
              <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">{label}</p>
              {value ? <p key={value} className="sf-fade mt-0.5 text-sm font-medium leading-snug text-gray-800">{value}</p> : <span className="sf-skeleton mt-1.5 block h-3 w-3/5" />}
            </div>
          </li>)}
        </ul>

        {volumeSeen && <div className="sf-fade border-t border-gray-100 p-5">
          <p className="text-[11px] font-medium uppercase tracking-wider text-gray-400">Temps récupérable estimé</p>
          <p className="mt-1 font-display text-3xl font-bold tabular-nums text-gray-900">{fmt(savings.hours)} h<span className="text-base font-medium text-gray-400"> / an</span></p>
          <p className="mt-1 text-xs text-gray-500">Soit environ {fmt(savings.value)} € de temps valorisé, d’après votre volume.</p>
        </div>}
      </div>

      <div className="mt-5 flex items-center justify-center gap-2 text-xs text-gray-400">
        <span className="h-1 w-24 overflow-hidden rounded-full bg-gray-200"><span className="block h-full rounded-full bg-blue-500 transition-all duration-500" style={{ width: `${(filled / (rows.length + 1)) * 100}%` }} /></span>
        {filled}/{rows.length + 1}
      </div>
    </div>
  </div>;
}
