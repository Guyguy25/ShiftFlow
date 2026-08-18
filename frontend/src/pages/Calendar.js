import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, AlertTriangle, CheckCircle2 } from "lucide-react";
import { api } from "../lib/api";

const MONTHS = ["Janvier","Février","Mars","Avril","Mai","Juin","Juillet","Août","Septembre","Octobre","Novembre","Décembre"];
const DAYS = ["Lun","Mar","Mer","Jeu","Ven","Sam","Dim"];

function daysGrid(year, month) {
  // month is 0-indexed. Return array of {date, inMonth} for a 6-row grid Monday-first.
  const first = new Date(year, month, 1);
  const start = new Date(first);
  const dow = (first.getDay() + 6) % 7; // Mon=0
  start.setDate(first.getDate() - dow);
  const grid = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    grid.push({ date: d, inMonth: d.getMonth() === month });
  }
  return grid;
}

function fmt(d) {
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
}

export default function Calendar() {
  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [missions, setMissions] = useState([]);

  useEffect(() => {
    api.get("/missions").then((r) => setMissions(r.data)).catch(() => {});
  }, []);

  const grid = useMemo(() => daysGrid(year, month), [year, month]);

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const map = {};
    for (const m of missions) {
      for (const sh of (m.shifts || [])) {
        (map[sh.date] = map[sh.date] || []).push({ ...sh, mission_name: m.name, mission_id: m.id, mission_status: m.status });
      }
    }
    return map;
  }, [missions]);

  const prev = () => {
    let ny = year, nm = month - 1;
    if (nm < 0) { nm = 11; ny -= 1; }
    setMonth(nm); setYear(ny);
  };
  const next = () => {
    let ny = year, nm = month + 1;
    if (nm > 11) { nm = 0; ny += 1; }
    setMonth(nm); setYear(ny);
  };
  const goToday = () => { setYear(today.getFullYear()); setMonth(today.getMonth()); };

  const todayStr = fmt(today);

  return (
    <div data-testid="calendar-page">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <div className="text-xs uppercase tracking-widest text-blue-700 font-bold">Calendrier</div>
          <h1 className="mt-2 text-3xl font-display font-bold tracking-tight" data-testid="calendar-title">
            {MONTHS[month]} {year}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={prev} data-testid="calendar-prev" className="p-2 rounded-md border border-gray-300 hover:bg-gray-50"><ChevronLeft className="w-4 h-4"/></button>
          <button onClick={goToday} data-testid="calendar-today" className="px-3 py-2 rounded-md border border-gray-300 hover:bg-gray-50 text-sm font-medium">Aujourd'hui</button>
          <button onClick={next} data-testid="calendar-next" className="p-2 rounded-md border border-gray-300 hover:bg-gray-50"><ChevronRight className="w-4 h-4"/></button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-7 text-xs uppercase tracking-widest text-gray-500 font-semibold border-b border-gray-200 pb-2">
        {DAYS.map((d) => <div key={d} className="px-2">{d}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-px bg-gray-200 mt-2 rounded-xl overflow-hidden border border-gray-200">
        {grid.map(({ date, inMonth }, i) => {
          const key = fmt(date);
          const shifts = shiftsByDate[key] || [];
          const isToday = key === todayStr;
          return (
            <div key={i} data-testid={`calendar-cell-${key}`} className={`bg-white min-h-[120px] p-2 relative ${!inMonth ? "opacity-40" : ""}`}>
              <div className={`text-xs font-semibold ${isToday ? "text-blue-700" : "text-gray-500"}`}>
                {date.getDate()}
                {isToday && <span className="ml-1 inline-block w-1.5 h-1.5 rounded-full bg-blue-600"/>}
              </div>
              <div className="mt-1 space-y-1">
                {shifts.map((sh) => {
                  const filled = sh.confirmed_count >= sh.people_needed;
                  const missing = Math.max(0, sh.people_needed - sh.confirmed_count);
                  const cls = sh.mission_status === "cancelled" ? "status-cancelled" :
                              filled ? "status-confirmed" :
                              missing > 0 ? "status-waiting" : "status-contacted";
                  return (
                    <Link
                      key={sh.id}
                      to={`/app/missions/${sh.mission_id}`}
                      data-testid={`calendar-shift-${sh.id}`}
                      className={`block text-xs px-1.5 py-1 rounded border ${cls} hover:opacity-80 transition-opacity truncate`}
                      title={`${sh.mission_name} · ${sh.start_time}-${sh.end_time} · ${sh.confirmed_count}/${sh.people_needed}`}
                    >
                      <div className="flex items-center gap-1">
                        {filled ? <CheckCircle2 className="w-3 h-3 shrink-0"/> : missing > 0 && sh.mission_status !== "cancelled" ? <AlertTriangle className="w-3 h-3 shrink-0"/> : null}
                        <span className="truncate">{sh.start_time} {sh.mission_name}</span>
                      </div>
                      <div className="text-[10px] font-semibold">{sh.confirmed_count}/{sh.people_needed}</div>
                    </Link>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 flex flex-wrap gap-3 text-xs text-gray-600">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded border status-confirmed"/> Équipe complète</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded border status-waiting"/> Manque des personnes</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded border status-contacted"/> En cours</div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded border status-cancelled"/> Annulée</div>
      </div>
    </div>
  );
}
