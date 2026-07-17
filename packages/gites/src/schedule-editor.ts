import {
  createPrompt,
  useState,
  useKeypress,
  isEnterKey,
  isUpKey,
  isDownKey,
  isTabKey,
} from "@inquirer/core";
import pc from "picocolors";
import { accent } from "./colors.js";
import { parseHHMM, localDate, type Stamp } from "./time-distribution.js";

export interface CommitRow {
  sha: string;
  subject: string;
}

export interface ScheduleEditorConfig {
  title: string;
  subtitle: string;
  overflow?: string;
  rows: CommitRow[];
  schedule: Stamp[];
  regenerate: () => Stamp[];
  validate: (schedule: readonly Stamp[]) => boolean;
}

export type ScheduleEditorResult = { action: "confirm"; schedule: Stamp[] } | { action: "abort" };

const ACTIONS = ["✓ Confirm and ship", "↻ Regenerate random times", "✗ Abort"] as const;

function fmt(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}

function shiftTime(time: string, deltaMin: number): string {
  const cur = parseHHMM(time) ?? 0;
  return fmt(Math.max(0, Math.min(24 * 60 - 1, cur + deltaMin)));
}

function shiftDate(date: string, deltaDays: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y!, m! - 1, d!);
  dt.setDate(dt.getDate() + deltaDays);
  return localDate(dt);
}

function field(label: string, value: string, active: boolean): string {
  const box = `${label}  [ ${value} ]`;
  return active ? accent(box) : pc.dim(box);
}

export const editSchedule = createPrompt<ScheduleEditorResult, ScheduleEditorConfig>(
  (config, done) => {
    const n = config.rows.length;
    const total = n + ACTIONS.length;
    const [schedule, setSchedule] = useState<Stamp[]>(config.schedule.slice());
    const [cursor, setCursor] = useState<number>(n); // start on Confirm
    const [mode, setMode] = useState<"list" | "edit">("list");
    const [editField, setEditField] = useState<"date" | "time">("time");
    const [error, setError] = useState<string>("");

    useKeypress((key) => {
      if (mode === "edit") {
        const idx = cursor;
        if (key.name === "escape") {
          setMode("list");
          return;
        }
        if (isEnterKey(key)) {
          setMode("list");
          return;
        }
        if (isTabKey(key) || isUpKey(key) || isDownKey(key)) {
          setEditField(editField === "date" ? "time" : "date");
          return;
        }
        if (key.name === "left" || key.name === "right") {
          const dir = key.name === "right" ? 1 : -1;
          const next = schedule.slice();
          next[idx] =
            editField === "time"
              ? { ...next[idx]!, time: shiftTime(next[idx]!.time, dir * 15) }
              : { ...next[idx]!, date: shiftDate(next[idx]!.date, dir) };
          setSchedule(next);
        }
        return;
      }

      if (isUpKey(key)) {
        setCursor((cursor - 1 + total) % total);
        setError("");
        return;
      }
      if (isDownKey(key)) {
        setCursor((cursor + 1) % total);
        setError("");
        return;
      }
      if ((key.name === "left" || key.name === "right") && cursor < n) {
        const delta = key.name === "right" ? 15 : -15;
        const next = schedule.slice();
        next[cursor] = { ...next[cursor]!, time: shiftTime(next[cursor]!.time, delta) };
        setSchedule(next);
        setError("");
        return;
      }
      if (isEnterKey(key)) {
        if (cursor < n) {
          setEditField("time");
          setMode("edit");
          return;
        }
        const action = cursor - n;
        if (action === 0) {
          if (!config.validate(schedule)) {
            setError("Times invalid or not strictly increasing. Fix them first.");
            return;
          }
          done({ action: "confirm", schedule });
        } else if (action === 1) {
          setSchedule(config.regenerate());
          setError("");
        } else {
          done({ action: "abort" });
        }
      }
    });

    const head = [pc.bold(accent(config.title)), pc.dim(config.subtitle)];
    if (config.overflow) head.push(pc.yellow(config.overflow));

    if (mode === "edit") {
      const idx = cursor;
      const row = config.rows[idx]!;
      const st = schedule[idx]!;
      const body = [
        "",
        `Editing commit ${idx + 1}:  ${pc.dim(row.sha.slice(0, 8))}  ${row.subject}`,
        "",
        `  ${field("Date", st.date, editField === "date")}     ${field("Time", st.time, editField === "time")}`,
        "",
        pc.dim(
          "  ←/→ adjust (time ±15m, date ±1d) · ↑↓/Tab switch field · Enter save · Esc cancel",
        ),
      ];
      return `${head.join("\n")}\n${body.join("\n")}`;
    }

    const listLines = config.rows.map((row, i) => {
      const st = schedule[i]!;
      const label = `${st.date.slice(5)} ${st.time.padEnd(5)}  ${row.sha.slice(0, 8)}  ${row.subject}`;
      return cursor === i ? accent(`> ${label}`) : `  ${label}`;
    });
    const actionLines = ACTIONS.map((a, k) => (cursor === n + k ? accent(`> ${a}`) : `  ${a}`));
    const hint = pc.dim("↑↓ navigate · ←/→ shift selected time ±15m · Enter edit/confirm");
    const body = ["", ...listLines, pc.dim("  " + "─".repeat(12)), ...actionLines, "", hint];
    if (error) body.push(pc.red(error));
    return `${head.join("\n")}\n${body.join("\n")}`;
  },
);
