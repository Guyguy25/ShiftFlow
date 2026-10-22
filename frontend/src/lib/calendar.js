export const dateKey = d => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
export function parseDay(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value || "")) return null;
  const [y,m,d] = value.split("-").map(Number), date = new Date(y,m-1,d,12);
  return dateKey(date) === value ? date : null;
}
export function monthGrid(month) {
  const y=month.getFullYear(), m=month.getMonth(), offset=(new Date(y,m,1).getDay()+6)%7;
  return Array.from({length:Math.ceil((offset+new Date(y,m+1,0).getDate())/7)*7},(_,i)=>new Date(y,m,1-offset+i,12));
}
export function shiftState(shift) {
  if (shift.status === "cancelled" || shift.mission_status === "cancelled") return "cancelled";
  return Number(shift.confirmed_count || 0) >= Number(shift.people_needed || 0) ? "complete" : "missing";
}
export function calendarShifts(missions) {
  return missions.flatMap(m => (m.shifts || []).filter(s => !s.deleted_at && parseDay(s.date)).map(s => ({...s,mission_id:m.id,mission_name:m.name || "Mission",mission_status:m.status,location:m.location || ""})));
}
export const lastDay = s => parseDay(s.end_date) && s.end_date >= s.date ? s.end_date : s.date;
export function shiftsOnDay(shifts, day) {
  return shifts.filter(s => s.date <= day && lastDay(s) >= day).sort((a,b)=>a.date.localeCompare(b.date)||(a.start_time||"").localeCompare(b.start_time||"")||a.mission_name.localeCompare(b.mission_name));
}
