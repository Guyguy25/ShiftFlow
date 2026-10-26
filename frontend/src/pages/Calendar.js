import { readPageData, peekPageData } from "../lib/pageData";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowRight, CalendarDays, CheckCircle2, ChevronLeft, ChevronRight, Clock3, List, MapPin, Plus, Search, XCircle } from "lucide-react";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { workspacePath } from "../lib/workspacePaths";
import { calendarShifts, dateKey, lastDay, monthGrid, parseDay, shiftsOnDay, shiftState } from "../lib/calendar";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const STATES = {
  missing: { label: "À compléter", icon: AlertTriangle, style: "border-amber-200 bg-amber-50 text-amber-800", dot: "bg-amber-500" },
  complete: { label: "Équipe complète", icon: CheckCircle2, style: "border-emerald-200 bg-emerald-50 text-emerald-800", dot: "bg-emerald-500" },
  cancelled: { label: "Annulé", icon: XCircle, style: "border-gray-200 bg-gray-100 text-gray-500", dot: "bg-gray-400" },
};
const dayLabel = day => parseDay(day)?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
const monthLabel = date => date.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
const button = "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-sm font-medium text-gray-700 hover:bg-gray-50 focus-visible:ring-2 focus-visible:ring-blue-500";

function ShiftCard({ shift, to }) {
  const status = shiftState(shift), state = STATES[status], Icon = state.icon;
  const missing = Math.max(0, Number(shift.people_needed || 0) - Number(shift.confirmed_count || 0));
  return <Link to={to} data-testid={`calendar-shift-${shift.id}`} className="group block rounded-xl border border-gray-200 bg-white p-4 transition-colors hover:border-blue-300 hover:bg-blue-50/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500">
    <div className="flex items-start justify-between gap-3"><h3 className={`min-w-0 break-words text-sm font-semibold text-gray-950 ${status === "cancelled" ? "line-through" : ""}`}>{shift.mission_name}</h3><ArrowRight size={16} className="mt-0.5 shrink-0 text-gray-400 group-hover:text-blue-600"/></div>
    <p className="mt-2 flex items-start gap-2 text-xs text-gray-600"><Clock3 size={14} className="shrink-0"/><span>{shift.start_time || "—"} – {shift.end_time || "—"}{lastDay(shift) > shift.date ? ` · jusqu’au ${parseDay(lastDay(shift)).toLocaleDateString("fr-FR", {day:"numeric",month:"short"})}` : shift.end_time && shift.end_time <= shift.start_time ? " · lendemain" : ""}</span></p>
    {shift.location && <p className="mt-1.5 flex items-start gap-2 text-xs text-gray-500"><MapPin size={14} className="shrink-0"/><span className="break-words">{shift.location}</span></p>}
    <div className="mt-3 flex flex-wrap items-center gap-2"><span className={`inline-flex items-center gap-1.5 rounded-lg border px-2 py-1 text-[11px] font-semibold ${state.style}`}><Icon size={13}/>{state.label}</span>{status !== "cancelled" && <span className="text-xs text-gray-500">{shift.confirmed_count || 0}/{shift.people_needed || 0} confirmé(s){missing ? ` · ${missing} manquant(s)` : ""}</span>}</div>
  </Link>;
}

export default function Calendar() {
  const { user } = useAuth();
  const today = dateKey(new Date());
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1, 12));
  const [selected, setSelected] = useState(today);
  const [missions, setMissions] = useState(() => peekPageData("/missions") ?? []);
  const [loading, setLoading] = useState(() => !peekPageData("/missions"));
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all");
  const [view, setView] = useState(() => typeof window.matchMedia === "function" && window.matchMedia("(max-width: 767px)").matches ? "agenda" : "month");
  const scoped = path => workspacePath(user?.organization?.id, path);
  const load = useCallback(async () => {
    setLoading(!peekPageData("/missions")); setError(false);
    try { const {data} = await readPageData(api, "/missions"); if (!Array.isArray(data)) throw new Error("Invalid calendar data"); setMissions(data); }
    catch { setError(true); } finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);
  const shifts = useMemo(() => calendarShifts(missions), [missions]);
  const visible = useMemo(() => shifts.filter(s => (filter === "all" || shiftState(s) === filter) && `${s.mission_name} ${s.location}`.toLocaleLowerCase("fr").includes(query.trim().toLocaleLowerCase("fr"))), [shifts,filter,query]);
  const grid = useMemo(() => monthGrid(month), [month]);
  const agenda = grid.filter(d => d.getMonth() === month.getMonth()).map(d => ({day:dateKey(d),shifts:shiftsOnDay(visible,dateKey(d))})).filter(item => item.shifts.length);
  const first = dateKey(month), last = dateKey(new Date(month.getFullYear(),month.getMonth()+1,0,12));
  const active = shifts.filter(s => s.date <= last && lastDay(s) >= first && shiftState(s) !== "cancelled");
  const missingCount = active.filter(s => shiftState(s) === "missing").length;
  const selectedShifts = shiftsOnDay(visible,selected);
  const nextUpcoming = [...shifts].filter(item => item.date >= today && shiftState(item) !== "cancelled").sort((a,b) => a.date.localeCompare(b.date) || (a.start_time || "").localeCompare(b.start_time || ""))[0];
  function moveMonth(delta) { const next = new Date(month.getFullYear(),month.getMonth()+delta,1,12); setMonth(next); setSelected(dateKey(next)); }
  function selectDay(day) { setSelected(dateKey(day)); if (day.getMonth() !== month.getMonth() || day.getFullYear() !== month.getFullYear()) setMonth(new Date(day.getFullYear(),day.getMonth(),1,12)); }
  function dayKeys(event,date) {
    const delta = {ArrowLeft:-1,ArrowRight:1,ArrowUp:-7,ArrowDown:7}[event.key]; if (!delta) return;
    event.preventDefault(); const next = new Date(date); next.setDate(next.getDate()+delta); selectDay(next);
    requestAnimationFrame(() => document.querySelector(`[data-day="${dateKey(next)}"]`)?.focus());
  }
  const card = shift => <ShiftCard key={shift.id} shift={shift} to={scoped(`/app/missions/${encodeURIComponent(shift.mission_id)}`)}/>;
  return <div data-testid="calendar-page">
    <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start"><div><div className="text-[11px] font-bold uppercase tracking-[0.16em] text-blue-700">Planning</div><h1 className="mt-1.5 font-display text-[28px] font-bold tracking-tight sm:text-3xl">Votre calendrier</h1><p className="mt-2 text-sm text-gray-500">Vos missions, vos dates et les équipes à compléter.</p></div><Link to={scoped("/app/missions/new")} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 text-sm font-semibold text-white hover:bg-blue-700"><Plus size={17}/>Créer une mission</Link></div>
    <div className="mt-6 grid grid-cols-3 gap-2 sm:gap-4" aria-label="Résumé du mois">{[[new Set(active.map(s=>s.mission_id)).size,"missions","text-gray-950"],[active.length,"créneaux","text-gray-950"],[missingCount,"à compléter",missingCount?"text-amber-700":"text-emerald-700"]].map(([count,label,color])=><div key={label} className="rounded-xl border border-gray-200 bg-white p-3 sm:p-4"><p className={`text-2xl font-bold tabular-nums ${color}`}>{loading||error?"—":count}</p><p className="mt-1 text-[11px] text-gray-500 sm:text-xs">{label} ce mois-ci</p></div>)}</div>
    {!loading && !error && active.length === 0 && nextUpcoming && <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-blue-100 bg-blue-50 p-4" data-testid="calendar-next-mission">
      <div><p className="text-xs font-semibold uppercase tracking-wider text-blue-700">Prochaine mission programmée</p><p className="mt-1 text-sm font-semibold text-gray-950">{nextUpcoming.mission_name} · {nextUpcoming.date}</p><p className="mt-0.5 text-xs text-gray-600">Aucun créneau dans le mois affiché.</p></div>
      <Link to={scoped(`/app/missions/${nextUpcoming.mission_id}`)} className="inline-flex items-center gap-2 text-sm font-semibold text-blue-700">Voir la mission <ArrowRight size={15}/></Link>
    </div>}
    <section className="mt-5 rounded-2xl border border-gray-200 bg-white p-3 sm:p-5" aria-label="Calendrier des missions">
      <div className="flex flex-wrap items-center justify-between gap-3"><div className="flex min-w-0 items-center gap-1"><button type="button" aria-label="Mois précédent" onClick={()=>moveMonth(-1)} data-testid="calendar-prev" className={button}><ChevronLeft size={17}/></button><h2 className="min-w-0 px-1 text-center text-base font-bold capitalize sm:px-3 sm:text-lg" data-testid="calendar-title" aria-live="polite">{monthLabel(month)}</h2><button type="button" aria-label="Mois suivant" onClick={()=>moveMonth(1)} data-testid="calendar-next" className={button}><ChevronRight size={17}/></button></div><button type="button" className={button} data-testid="calendar-today" onClick={()=>{const now=parseDay(today);setMonth(new Date(now.getFullYear(),now.getMonth(),1,12));setSelected(today);}}>Aujourd’hui</button></div>
      <div className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 md:flex-row"><label className="relative min-w-0 flex-1"><Search size={16} className="absolute left-3 top-3.5 text-gray-400"/><span className="sr-only">Rechercher une mission ou un lieu dans le calendrier</span><input type="search" value={query} onChange={e=>setQuery(e.target.value)} placeholder="Rechercher une mission ou un lieu…" className="h-11 w-full rounded-xl border border-gray-200 bg-gray-50 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"/></label><label><span className="sr-only">Filtrer les créneaux</span><select aria-label="Filtrer les créneaux" value={filter} onChange={e=>setFilter(e.target.value)} className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm md:w-auto"><option value="all">Tous les créneaux</option><option value="missing">À compléter</option><option value="complete">Équipes complètes</option><option value="cancelled">Annulés</option></select></label><div className="grid grid-cols-2 gap-1 rounded-xl bg-gray-100 p-1" role="group" aria-label="Affichage du calendrier">{[["month","Mois",CalendarDays],["agenda","Agenda",List]].map(([value,label,Icon])=><button type="button" key={value} aria-pressed={view===value} onClick={()=>setView(value)} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium ${view===value?"bg-white text-blue-700 shadow-sm":"text-gray-500 hover:text-gray-900"}`}><Icon size={16}/>{label}</button>)}</div></div>
      {loading?<p role="status" className="py-16 text-center text-sm text-gray-500">Chargement du calendrier…</p>:error?<div role="alert" className="my-6 rounded-xl border border-red-100 bg-red-50 p-5 text-sm text-red-700"><p>Impossible de charger vos missions.</p><button type="button" onClick={load} className="mt-3 min-h-11 rounded-lg border border-red-200 bg-white px-4 font-semibold">Réessayer</button></div>:<>
        {view==="month"?<div className="mt-5 grid items-start gap-5 xl:grid-cols-[minmax(0,1fr)_300px]">
          <div className="min-w-0"><div className="grid grid-cols-7 pb-2 text-center text-[11px] font-semibold text-gray-400">{DAYS.map(d=><span key={d}>{d}</span>)}</div><div className="grid grid-cols-7 gap-px overflow-hidden rounded-xl border border-gray-200 bg-gray-200">{grid.map(date=>{
            const day=dateKey(date), items=shiftsOnDay(visible,day), inMonth=date.getMonth()===month.getMonth();
            return <button type="button" key={day} data-day={day} data-testid={`calendar-cell-${day}`} aria-label={`${dayLabel(day)} ${date.getFullYear()}, ${items.length} créneau(x)`} aria-pressed={selected===day} aria-current={day===today?"date":undefined} onClick={()=>selectDay(date)} onKeyDown={event=>dayKeys(event,date)} className={`relative min-h-[68px] min-w-0 p-1 text-left outline-none transition-colors sm:min-h-[112px] sm:p-2 ${selected===day?"z-10 bg-blue-50 ring-2 ring-inset ring-blue-500":inMonth?"bg-white hover:bg-gray-50":"bg-gray-50 text-gray-400"} focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-blue-600`}>
              <span className={`inline-flex h-7 w-7 items-center justify-center rounded-full text-xs font-semibold ${day===today?"bg-blue-600 text-white":inMonth?"text-gray-700":"text-gray-400"}`}>{date.getDate()}</span><span className="mt-1 hidden space-y-1 sm:block">{items.slice(0,2).map(s=><span key={s.id} className={`block truncate rounded border px-1.5 py-1 text-[10px] font-medium ${STATES[shiftState(s)].style}`}>{s.start_time} {s.mission_name}</span>)}{items.length>2&&<span className="block text-[10px] font-semibold text-gray-500">+{items.length-2} autre(s)</span>}</span><span className="mt-1 flex flex-wrap gap-1 sm:hidden" aria-hidden="true">{items.slice(0,3).map(s=><span key={s.id} className={`h-1.5 w-1.5 rounded-full ${STATES[shiftState(s)].dot}`}/>)}{items.length>3&&<span className="text-[9px] leading-none text-gray-500">+{items.length-3}</span>}</span>
            </button>;
          })}</div><p className="mt-3 text-xs text-gray-500">Sélectionnez une date pour voir ses créneaux.</p></div>
          <aside className="min-w-0 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:p-4" aria-label="Détail de la journée"><h3 className="font-semibold capitalize text-gray-950">{dayLabel(selected)}</h3><p className="mt-1 text-xs text-gray-500">{selectedShifts.length} créneau(x){selected===today?" · Aujourd’hui":""}</p><div className="mt-4 space-y-3">{selectedShifts.length?selectedShifts.map(card):<p className="rounded-lg bg-white p-4 text-sm text-gray-500">{filter!=="all"||query?"Aucun créneau ne correspond à vos filtres ce jour-là.":"Aucun créneau prévu ce jour-là."}</p>}</div></aside>
        </div>:<div className="mt-5 space-y-6">{agenda.length?agenda.map(({day,shifts:items})=><section key={day} aria-label={dayLabel(day)}><div className="mb-3 flex items-center gap-3"><h3 className="text-sm font-semibold capitalize text-gray-900">{dayLabel(day)}</h3>{day===today&&<span className="rounded-full bg-blue-50 px-2 py-1 text-[10px] font-bold text-blue-700">Aujourd’hui</span>}<span className="ml-auto text-xs text-gray-400">{items.length} créneau(x)</span></div><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{items.map(card)}</div></section>):<div className="rounded-xl border border-dashed border-gray-200 py-12 text-center"><CalendarDays size={28} className="mx-auto text-gray-300"/><p className="mt-3 text-sm font-medium text-gray-600">{query||filter!=="all"?"Aucun créneau ne correspond à ces filtres ce mois-ci.":"Aucun créneau prévu ce mois-ci."}</p>{query||filter!=="all"?<button type="button" onClick={()=>{setQuery("");setFilter("all");}} className="mt-3 min-h-11 text-sm font-semibold text-blue-700">Effacer les filtres</button>:<Link to={scoped("/app/missions/new")} className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-blue-700">Créer votre prochaine mission <ArrowRight size={15} className="ml-2"/></Link>}</div>}</div>}
        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2 border-t border-gray-100 pt-4 text-[11px] text-gray-500">{Object.entries(STATES).map(([key,state])=><span key={key} className="inline-flex items-center gap-1.5"><span className={`h-2 w-2 rounded-full ${state.dot}`}/>{state.label}</span>)}</div>
      </>}
    </section>
  </div>;
}
