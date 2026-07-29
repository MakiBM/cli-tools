import { test } from "vitest";
import assert from "node:assert/strict";
import { render } from "@inquirer/testing";
import { editSessionWindow, type SessionEditorConfig } from "../src/session-editor.js";

const now = { date: "2026-07-15", time: "14:30" };

function baseConfig(overrides: Partial<SessionEditorConfig> = {}): SessionEditorConfig {
  return {
    title: "Session window",
    subtitle: "Defaults 08:00-18:00",
    window: { start: { date: "2026-07-14", time: "09:00" }, end: { ...now } },
    now,
    dayStartMin: 8 * 60,
    dayEndMin: 18 * 60,
    commits: 3,
    ...overrides,
  };
}

// Cursor starts on Continue (index 4); `up` walks back through end time, end date,
// start time, start date.
function toCell(events: { keypress: (k: string) => void }, index: number): void {
  for (let i = 4; i > index; i--) events.keypress("up");
}

test("start time steps by 15 min and stops at 08:00", async () => {
  const { answer, events } = await render(editSessionWindow, baseConfig());

  toCell(events, 1);
  for (let i = 0; i < 5; i++) events.keypress("left"); // 09:00 -> 08:00, then clamped

  events.keypress("down");
  events.keypress("down");
  events.keypress("down");
  events.keypress("enter");

  const result = await answer;
  assert.deepEqual(result.action === "confirm" && result.window.start, {
    date: "2026-07-14",
    time: "08:00",
  });
});

test("end time never moves past now", async () => {
  const { answer, events } = await render(editSessionWindow, baseConfig());

  toCell(events, 3);
  events.keypress("right");
  events.keypress("right");

  events.keypress("down");
  events.keypress("enter");

  const result = await answer;
  assert.deepEqual(result.action === "confirm" && result.window.end, now);
});

test("end time reaches 18:00 on a past day", async () => {
  const { answer, events } = await render(editSessionWindow, baseConfig());

  toCell(events, 2);
  events.keypress("left"); // end date -> 2026-07-14
  events.keypress("down"); // -> end time
  for (let i = 0; i < 20; i++) events.keypress("right"); // 14:30 -> 18:00, then clamped

  events.keypress("down");
  events.keypress("enter");

  const result = await answer;
  assert.deepEqual(result.action === "confirm" && result.window.end, {
    date: "2026-07-14",
    time: "18:00",
  });
});

test("end date cannot move into the future", async () => {
  const { answer, events } = await render(editSessionWindow, baseConfig());

  toCell(events, 2);
  events.keypress("right");

  events.keypress("down");
  events.keypress("down");
  events.keypress("enter");

  const result = await answer;
  assert.deepEqual(result.action === "confirm" && result.window.end, now);
});

test("start cannot be pushed past end", async () => {
  const { answer, events } = await render(
    editSessionWindow,
    baseConfig({
      window: { start: { date: "2026-07-15", time: "14:15" }, end: { ...now } },
    }),
  );

  toCell(events, 1);
  events.keypress("right"); // 14:30 would equal end -> rejected

  events.keypress("down");
  events.keypress("down");
  events.keypress("down");
  events.keypress("enter");

  const result = await answer;
  assert.deepEqual(result.action === "confirm" && result.window.start, {
    date: "2026-07-15",
    time: "14:15",
  });
});

test("Abort resolves with abort action", async () => {
  const { answer, events } = await render(editSessionWindow, baseConfig());
  events.keypress("down"); // Continue -> Abort
  events.keypress("enter");
  assert.deepEqual(await answer, { action: "abort" });
});
