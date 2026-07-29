import {
  createPrompt,
  useState,
  useKeypress,
  isEnterKey,
  isUpKey,
  isDownKey,
} from "@inquirer/core";
import pc from "picocolors";
import { accent } from "./colors.js";
import { parseHHMM, addDays, absMinutes, type Stamp } from "./time-distribution.js";

export interface SessionWindow {
  start: Stamp;
  end: Stamp;
}

export interface SessionEditorConfig {
  title: string;
  subtitle: string;
  window: SessionWindow;
  now: Stamp;
  dayStartMin: number;
  dayEndMin: number;
  commits: number;
}

export type SessionEditorResult =
  | { action: "confirm"; window: SessionWindow }
  | { action: "abort" };

const ACTIONS = ["✓ Continue", "✗ Abort"] as const;
const STEP_MIN = 15;
const CELLS = [
  { edge: "start", field: "date" },
  { edge: "start", field: "time" },
  { edge: "end", field: "date" },
  { edge: "end", field: "time" },
] as const;

function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

// The working-hours defaults are a floor/ceiling for manual edits, not a cage: a
// stamp that already sits outside them keeps its value and can only move back
// toward the range. `now` is the one hard limit - no stamp may land in the future.
function timeBounds(stamp: Stamp, config: SessionEditorConfig): [number, number] {
  const cur = parseHHMM(stamp.time) ?? config.dayStartMin;
  const lo = Math.min(config.dayStartMin, cur);
  let hi = Math.max(config.dayEndMin, cur);
  if (stamp.date >= config.now.date) hi = Math.min(hi, parseHHMM(config.now.time) ?? hi);
  return [lo, hi];
}

function shiftTime(stamp: Stamp, delta: number, config: SessionEditorConfig): Stamp {
  const [lo, hi] = timeBounds(stamp, config);
  const cur = parseHHMM(stamp.time) ?? lo;
  return { date: stamp.date, time: fmt(Math.max(lo, Math.min(hi, cur + delta))) };
}

function shiftDate(stamp: Stamp, dir: number, config: SessionEditorConfig): Stamp {
  const date = addDays(stamp.date, dir);
  if (date > config.now.date) return stamp;
  const moved = { date, time: stamp.time };
  const [lo, hi] = timeBounds(moved, config);
  const cur = parseHHMM(stamp.time) ?? lo;
  return { date, time: fmt(Math.max(lo, Math.min(hi, cur))) };
}

function cell(value: string, active: boolean): string {
  const box = `[ ${value} ]`;
  return active ? accent(box) : pc.dim(box);
}

export const editSessionWindow = createPrompt<SessionEditorResult, SessionEditorConfig>(
  (config, done) => {
    const total = CELLS.length + ACTIONS.length;
    const [window, setWindow] = useState<SessionWindow>({ ...config.window });
    const [cursor, setCursor] = useState<number>(CELLS.length); // start on Continue

    useKeypress((key) => {
      if (isUpKey(key)) {
        setCursor((cursor - 1 + total) % total);
        return;
      }
      if (isDownKey(key)) {
        setCursor((cursor + 1) % total);
        return;
      }
      if ((key.name === "left" || key.name === "right") && cursor < CELLS.length) {
        const dir = key.name === "right" ? 1 : -1;
        const { edge, field } = CELLS[cursor]!;
        const cur = window[edge];
        const next =
          field === "time" ? shiftTime(cur, dir * STEP_MIN, config) : shiftDate(cur, dir, config);
        const candidate = { ...window, [edge]: next };
        if (absMinutes(candidate.start) < absMinutes(candidate.end)) setWindow(candidate);
        return;
      }
      if (isEnterKey(key) && cursor >= CELLS.length) {
        if (cursor - CELLS.length === 0) done({ action: "confirm", window });
        else done({ action: "abort" });
      }
    });

    const isNow = window.end.date === config.now.date && window.end.time === config.now.time;
    const rows = [
      `  Start:   ${cell(window.start.date, cursor === 0)} ${cell(window.start.time, cursor === 1)}`,
      `  End:     ${cell(window.end.date, cursor === 2)} ${cell(window.end.time, cursor === 3)}${
        isNow ? pc.dim("  (now)") : ""
      }`,
      `  Commits: ${config.commits}`,
    ];
    const actionLines = ACTIONS.map((a, k) =>
      cursor === CELLS.length + k ? accent(`> ${a}`) : `  ${a}`,
    );
    const hint = pc.dim(`↑↓ navigate · ←/→ adjust (time ±${STEP_MIN}m, date ±1d) · Enter continue`);
    const body = ["", ...rows, "", pc.dim("  " + "─".repeat(12)), ...actionLines, "", hint];
    return `${pc.bold(accent(config.title))}\n${pc.dim(config.subtitle)}\n${body.join("\n")}`;
  },
);
