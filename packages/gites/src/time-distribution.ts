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

// The canvas is the ordered day windows with the overnight gaps removed: a single
// contiguous minute axis [0, canvasLength]. Positions map onto real day/time via
// posToStamp, so distribution and editing ignore the non-working hours between days.
export function canvasLength(days: readonly DayWindow[]): number {
  return days.reduce((sum, d) => sum + (d.endMin - d.startMin), 0);
}

export function posToStamp(pos: number, days: readonly DayWindow[]): Stamp {
  let p = Math.max(0, Math.min(pos, canvasLength(days)));
  for (const d of days) {
    const len = d.endMin - d.startMin;
    if (p <= len) return { date: d.date, time: fmt(d.startMin + Math.round(p)) };
    p -= len;
  }
  const last = days[days.length - 1]!;
  return { date: last.date, time: fmt(last.endMin) };
}

export function stampToPos(stamp: Stamp, days: readonly DayWindow[]): number {
  let acc = 0;
  for (const d of days) {
    const len = d.endMin - d.startMin;
    if (stamp.date === d.date) {
      const m = parseHHMM(stamp.time) ?? d.startMin;
      return acc + Math.max(0, Math.min(len, m - d.startMin));
    }
    acc += len;
  }
  return acc;
}

// Place `sizes.length` commits (chronological order) across the canvas. The first
// commit lands at the canvas start (its real time), the newest at the canvas end
// (now). The gap before each later commit is 80% proportional to that commit's size
// (lines changed) and 20% random, so bigger commits get more time before them.
// Stamps stay strictly increasing, distinct, and inside the canvas. `rand` is
// injectable for deterministic tests.
export function distribute(
  sizes: readonly number[],
  days: readonly DayWindow[],
  rand: () => number = Math.random,
): Stamp[] {
  const n = sizes.length;
  if (n === 0 || days.length === 0) return [];
  const canvas = canvasLength(days);
  if (n === 1) return [posToStamp(canvas, days)];

  const SIZE_WEIGHT = 0.8;
  const gapSizes = sizes.slice(1).map((s) => Math.max(1, s)); // size of each later commit
  const totalSize = gapSizes.reduce((a, b) => a + b, 0);
  const r = gapSizes.map(() => rand() + 1e-6);
  const totalR = r.reduce((a, b) => a + b, 0);
  const weights = gapSizes.map(
    (s, i) => SIZE_WEIGHT * (s / totalSize) + (1 - SIZE_WEIGHT) * (r[i]! / totalR),
  );

  const pos = [0];
  let cum = 0;
  for (const w of weights) {
    cum += w;
    pos.push(Math.round(cum * canvas));
  }

  // Keep strictly increasing and distinct at minute resolution, clamped to canvas.
  for (let i = 1; i < n; i++) {
    if (pos[i]! <= pos[i - 1]!) pos[i] = pos[i - 1]! + 1;
  }
  if (pos[n - 1]! > canvas) {
    pos[n - 1] = canvas;
    for (let i = n - 2; i >= 0; i--) {
      if (pos[i]! >= pos[i + 1]!) pos[i] = pos[i + 1]! - 1;
    }
  }

  return pos.map((p) => posToStamp(Math.max(0, p), days));
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
