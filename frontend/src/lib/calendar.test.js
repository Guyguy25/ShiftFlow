import { calendarShifts, dateKey, lastDay, monthGrid, parseDay, shiftsOnDay, shiftState } from "./calendar";
test("month grid starts on Monday and includes leap day without unnecessary rows",()=>{
 const grid=monthGrid(new Date(2024,1,1,12));expect(grid[0].getDay()).toBe(1);expect(grid).toHaveLength(35);expect(grid.map(dateKey)).toContain("2024-02-29");
 expect(monthGrid(new Date(2026,1,1,12))).toHaveLength(35);
});
test("invalid dates are rejected, including nonexistent days",()=>{expect(parseDay("2026-02-30")).toBeNull();expect(parseDay("bad")).toBeNull();expect(dateKey(parseDay("2024-02-29"))).toBe("2024-02-29");});
test("multi-day shifts appear every covered day including across month boundaries",()=>{
 const shifts=calendarShifts([{id:"m",name:"Festival",shifts:[{id:"s",date:"2026-10-31",end_date:"2026-11-02"}]}]);
 for(const day of ["2026-10-31","2026-11-01","2026-11-02"])expect(shiftsOnDay(shifts,day)).toHaveLength(1);
 expect(shiftsOnDay(shifts,"2026-11-03")).toHaveLength(0);
});
test("cancelled mission or shift never appears complete even with confirmed workers",()=>{
 expect(shiftState({status:"cancelled",confirmed_count:5,people_needed:5})).toBe("cancelled");
 expect(shiftState({mission_status:"cancelled",confirmed_count:5,people_needed:5})).toBe("cancelled");
 expect(shiftState({people_needed:5})).toBe("missing");
});
test("deleted shifts are omitted and invalid end dates fall back to the start",()=>{
 expect(calendarShifts([{id:"m",shifts:[{date:"2026-10-22",deleted_at:"now"},{date:"bad"}]}])).toEqual([]);
 expect(lastDay({date:"2026-10-22",end_date:"2026-10-20"})).toBe("2026-10-22");
});
test("shifts are ordered by date and start time",()=>{
 const shifts=calendarShifts([{id:"m",name:"Festival",shifts:[{id:"late",date:"2026-10-22",start_time:"18:00"},{id:"early",date:"2026-10-22",start_time:"08:00"}]}]);expect(shiftsOnDay(shifts,"2026-10-22").map(s=>s.id)).toEqual(["early","late"]);
});
