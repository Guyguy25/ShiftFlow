import React from "react";
import { Check, Clock, Link2, Sparkles, Users, Zap } from "lucide-react";

const fmt = value => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 0 }).format(value);
const initials = name => (name || "").trim().split(/\s+/).slice(0, 2).map(w => w[0]).join("").toUpperCase() || "SF";
const OLD_CHANNELS = ["WhatsApp", "Appels téléphoniques", "SMS", "Email"];

// Aperçu « live » de l'espace de travail, construit au fil des réponses
// (pattern Linear / Attio / Notion). Purement décoratif : aria-hidden.
export default function RegisterPreview({ agency, answers, savings, screen }) {
  const people = Math.max(1, Math.min(150, answers.people_per_mission || 15));
  const dots = Math.min(people, 30);
  const confirmed = Math.round(dots * 0.7);
  const channels = (answers.channels || []).filter(c => OLD_CHANNELS.includes(c));
  return <div className="sf-preview" aria-hidden="true" data-testid="register-preview">
    <div className="sf-preview-glow" />
    <p className="relative text-xs font-semibold uppercase tracking-[.18em] text-blue-200/80">Aperçu de votre espace</p>
    <div className="sf-preview-window">
      <div className="flex items-center gap-1.5 border-b border-white/10 px-4 py-3">
        <span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" /><span className="h-2.5 w-2.5 rounded-full bg-white/20" />
        <span className="ml-3 truncate text-[11px] text-white/40">app.shiftflow.io/{(agency || "votre-agence").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "votre-agence"}</span>
      </div>
      <div className="flex">
        <aside className="hidden w-36 shrink-0 border-r border-white/10 p-3 xl:block">
          <div className="flex items-center gap-2">
            <span key={initials(agency)} className="sf-pop grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 text-[11px] font-bold text-white">{initials(agency)}</span>
            <span className={`truncate text-xs font-semibold ${agency ? "text-white" : "text-white/40"}`}>{agency || "Votre agence"}</span>
          </div>
          {["Tableau de bord", "Missions", "Équipe", "Historique"].map((item, i) => <p key={item} className={`mt-2 rounded-md px-2 py-1.5 text-[11px] ${i === 1 ? "bg-white/10 text-white" : "text-white/40"}`}>{item}</p>)}
        </aside>
        <div className="min-w-0 flex-1 space-y-3 p-4">
          <div className="rounded-xl bg-white p-4 text-gray-900 shadow-lg">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0"><p className="text-[11px] font-semibold uppercase tracking-wider text-blue-600">Prochaine mission</p><p className="mt-1 truncate font-display text-base font-bold">Montage stand · Lille Grand Palais</p></div>
              <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-1 text-[11px] font-semibold text-emerald-700">{confirmed}/{dots}{people > dots ? "+" : ""}</span>
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">{Array.from({ length: dots }, (_, i) => <span key={i} className={`sf-dot ${i < confirmed ? "bg-emerald-500" : "bg-amber-300"}`} style={{ animationDelay: `${i * 18}ms` }} />)}</div>
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-gray-500"><Users size={12} />{fmt(people)} personnes · relances automatiques en cascade</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="flex items-center gap-1.5 text-[11px] font-semibold text-white/70"><Link2 size={12} />Un seul lien de confirmation</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {channels.length ? channels.map(c => <span key={c} className="sf-pop rounded-full bg-white/10 px-2 py-0.5 text-[11px] text-white/50 line-through decoration-rose-400/80">{c}</span>) : <span className="text-[11px] text-white/35">Fini les messages éparpillés</span>}
              {channels.length > 0 && <span className="sf-pop rounded-full bg-blue-500 px-2 py-0.5 text-[11px] font-semibold text-white"><Check size={10} className="mr-1 inline" />ShiftFlow</span>}
            </div>
          </div>
          {answers.priority && <div key={answers.priority} className="sf-pop flex items-center gap-2 rounded-xl border border-violet-300/20 bg-violet-400/10 p-3 text-[11px] text-violet-100"><Sparkles size={13} />Focus : {answers.priority}</div>}
        </div>
      </div>
    </div>
    <div className="relative mt-6 grid grid-cols-2 gap-3">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="flex items-center gap-1.5 text-[11px] text-white/50"><Clock size={12} />Temps libéré</p><p className="mt-1 font-display text-3xl font-bold tabular-nums text-white">{fmt(savings.hours)}<span className="text-lg text-white/60"> h/an</span></p></div>
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><p className="flex items-center gap-1.5 text-[11px] text-white/50"><Zap size={12} />Temps valorisé</p><p className="mt-1 font-display text-3xl font-bold tabular-nums text-white">{fmt(savings.value)}<span className="text-lg text-white/60"> €</span></p></div>
    </div>
    <p className="relative mt-3 text-[11px] text-white/35">{screen === "volume" ? "Bougez les curseurs : l’estimation se met à jour en direct." : "Estimation indicative, affinée par vos réponses."}</p>
  </div>;
}
