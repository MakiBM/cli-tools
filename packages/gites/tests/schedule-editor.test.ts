import { test } from "vitest";
import assert from "node:assert/strict";
import { render } from "@inquirer/testing";
import { editSchedule } from "../src/schedule-editor.js";
import { validateSchedule, type Stamp } from "../src/time-distribution.js";

const rows = [
  { sha: "aaaaaaaa11", subject: "first" },
  { sha: "bbbbbbbb22", subject: "second" },
];

function baseConfig(schedule: Stamp[]) {
  return {
    title: "Ship 2 commit(s)",
    subtitle: "Session",
    rows,
    schedule,
    regenerate: () => schedule,
    validate: validateSchedule,
  };
}

test("left/right shifts the selected commit time by 15 min", async () => {
  const schedule: Stamp[] = [
    { date: "2026-07-15", time: "10:00" },
    { date: "2026-07-15", time: "12:00" },
  ];
  const { answer, events } = await render(editSchedule, baseConfig(schedule));

  // cursor starts on Confirm (index n=2); up twice reaches the first commit.
  events.keypress("up"); // -> second commit
  events.keypress("up"); // -> first commit
  events.keypress("right"); // 10:00 -> 10:15
  events.keypress("right"); // 10:15 -> 10:30

  events.keypress("down"); // -> second commit
  events.keypress("down"); // -> Confirm
  events.keypress("enter"); // confirm

  const result = await answer;
  assert.deepEqual(result, {
    action: "confirm",
    schedule: [
      { date: "2026-07-15", time: "10:30" },
      { date: "2026-07-15", time: "12:00" },
    ],
  });
});

test("Enter opens edit view with date and time fields; arrows adjust each", async () => {
  const schedule: Stamp[] = [
    { date: "2026-07-15", time: "10:00" },
    { date: "2026-07-15", time: "12:00" },
  ];
  const { answer, events, getScreen } = await render(editSchedule, baseConfig(schedule));

  events.keypress("up");
  events.keypress("up"); // first commit
  events.keypress("enter"); // enter edit mode (time field active)

  assert.match(getScreen(), /Date/);
  assert.match(getScreen(), /Time/);

  events.keypress("right"); // time 10:00 -> 10:15
  events.keypress("tab"); // switch to date field
  events.keypress("left"); // date -1 day -> 2026-07-14 (keeps order valid)
  events.keypress("enter"); // save -> back to list (still on first commit)

  events.keypress("down"); // -> second commit
  events.keypress("down"); // -> Confirm
  events.keypress("enter");

  const result = await answer;
  assert.deepEqual(result.action === "confirm" && result.schedule[0], {
    date: "2026-07-14",
    time: "10:15",
  });
});

test("Abort resolves with abort action", async () => {
  const schedule: Stamp[] = [
    { date: "2026-07-15", time: "10:00" },
    { date: "2026-07-15", time: "12:00" },
  ];
  const { answer, events } = await render(editSchedule, baseConfig(schedule));
  events.keypress("down"); // Confirm -> Regenerate
  events.keypress("down"); // Regenerate -> Abort
  events.keypress("enter");
  assert.deepEqual(await answer, { action: "abort" });
});
