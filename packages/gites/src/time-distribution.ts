function fmt(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

export function parseHHMM(s: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(s);
  if (!m) return null;
  return parseInt(m[1]!, 10) * 60 + parseInt(m[2]!, 10);
}

export function isValidHHMM(s: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(s);
}

export function validateTimes(times: readonly string[]): boolean {
  let prev = -1;
  for (const t of times) {
    if (!isValidHHMM(t)) return false;
    const cur = parseHHMM(t);
    if (cur === null || cur <= prev) return false;
    prev = cur;
  }
  return true;
}

function pickDistinct(poolSize: number, count: number): number[] {
  const pool = Array.from({ length: poolSize }, (_, i) => i);
  for (let i = 0; i < count; i++) {
    const j = i + Math.floor(Math.random() * (pool.length - i));
    [pool[i], pool[j]] = [pool[j]!, pool[i]!];
  }
  return pool.slice(0, count).sort((a, b) => a - b);
}

export interface DayWindow {
  date: string; // 'YYYY-MM-DD'
  startMin: number; // inclusive; invariant startMin <= endMin
  endMin: number; // inclusive
}

export interface Stamp {
  date: string; // 'YYYY-MM-DD'
  time: string; // 'HH:MM'
}

export function localDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function minutesOf(d: Date): number {
  return d.getHours() * 60 + d.getMinutes();
}

function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}

export function buildDayWindows(
  startDT: Date,
  endDT: Date,
  offDates: ReadonlySet<string>,
  workStartMin: number,
  workEndMin: number,
): DayWindow[] {
  const startDate = localDate(startDT);
  const endDate = localDate(endDT);
  const windows: DayWindow[] = [];
  let cursor = new Date(startDT.getFullYear(), startDT.getMonth(), startDT.getDate());
  const last = new Date(endDT.getFullYear(), endDT.getMonth(), endDT.getDate());
  while (cursor.getTime() <= last.getTime()) {
    const date = localDate(cursor);
    if (!offDates.has(date)) {
      const dayStart =
        date === startDate ? Math.max(workStartMin, minutesOf(startDT)) : workStartMin;
      const dayEnd = date === endDate ? Math.min(minutesOf(endDT), workEndMin) : workEndMin;
      if (dayStart <= dayEnd) windows.push({ date, startMin: dayStart, endMin: dayEnd });
    }
    cursor = addDays(cursor, 1);
  }
  return windows;
}

export function dayCapacity(w: DayWindow, gap: number): number {
  return Math.floor((w.endMin - w.startMin) / gap) + 1;
}

export function genSchedule(count: number, days: readonly DayWindow[], gap: number): Stamp[] {
  if (days.length === 0 || count === 0) return [];
  const n = days.length;
  const spans = days.map((d) => Math.max(0, d.endMin - d.startMin));
  const total = spans.reduce((a, b) => a + b, 0);

  const alloc: number[] = Array.from({ length: n }, () => 0);
  if (total === 0) {
    alloc[n - 1] = count;
  } else {
    const raw = spans.map((s) => (count * s) / total);
    let assigned = 0;
    for (let i = 0; i < n; i++) {
      alloc[i] = Math.floor(raw[i]!);
      assigned += alloc[i]!;
    }
    let leftover = count - assigned;
    const order = raw
      .map((r, i) => ({ i, frac: r - Math.floor(r) }))
      .sort((a, b) => b.frac - a.frac || a.i - b.i);
    for (let k = 0; leftover > 0; k = (k + 1) % n, leftover--) {
      alloc[order[k]!.i]! += 1;
    }
  }

  // Cap non-final days at capacity and spill overflow forward; final day absorbs
  // the rest so genTimes spills past the window exactly as the single-day case.
  for (let i = 0; i < n - 1; i++) {
    const cap = dayCapacity(days[i]!, gap);
    if (alloc[i]! > cap) {
      alloc[i + 1]! += alloc[i]! - cap;
      alloc[i] = cap;
    }
  }

  const schedule: Stamp[] = [];
  for (let i = 0; i < n; i++) {
    if (alloc[i]! <= 0) continue;
    const times = genTimes(alloc[i]!, days[i]!.startMin, days[i]!.endMin, gap);
    for (const time of times) schedule.push({ date: days[i]!.date, time });
  }
  return schedule;
}

export function validateSchedule(schedule: readonly Stamp[]): boolean {
  let prev = "";
  for (const s of schedule) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s.date)) return false;
    if (!isValidHHMM(s.time)) return false;
    const [hh, mm] = s.time.split(":");
    const key = `${s.date}T${hh!.padStart(2, "0")}:${mm}`;
    if (key <= prev) return false;
    prev = key;
  }
  return true;
}

export function genTimes(count: number, startMin: number, endMin: number, gap: number): string[] {
  if (count === 1) {
    const t = startMin + Math.floor(Math.random() * (endMin - startMin + 1));
    return [fmt(t)];
  }
  const window = endMin - startMin;
  const needed = (count - 1) * gap;
  let times: number[];
  if (needed >= window) {
    times = Array.from({ length: count }, (_, i) => startMin + i * gap);
  } else {
    const slack = window - needed;
    const cuts = pickDistinct(slack + count, count);
    times = cuts.map((c, i) => startMin + c + i * gap - i);
    for (let i = 1; i < times.length; i++) {
      if (times[i]! < times[i - 1]! + gap) times[i] = times[i - 1]! + gap;
    }
  }
  return times.map(fmt);
}
