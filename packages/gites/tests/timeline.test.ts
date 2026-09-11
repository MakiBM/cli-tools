import { test } from "vitest";
import assert from "node:assert/strict";
import { render } from "@inquirer/testing";
import {
  setupSandbox,
  teardown,
  inDir,
  run,
  makeCommit,
  TEST_ORIGIN,
  type SandboxContext,
} from "./helpers.js";
import { startFeature } from "../src/start-feature.js";
import { timelineFloor } from "../src/timeline.js";
import { editableCanvas } from "../src/ship.js";
import { editSessionWindow, type SessionEditorConfig } from "../src/session-editor.js";

async function withSandbox(fn: (ctx: SandboxContext) => Promise<void> | void): Promise<void> {
  const ctx = setupSandbox();
  try {
    await inDir(ctx.work, async () => fn(ctx));
  } finally {
    teardown(ctx.sandbox);
  }
}

const stampedCommit = (msg: string, iso: string): void => {
  process.env.GIT_AUTHOR_DATE = iso;
  process.env.GIT_COMMITTER_DATE = iso;
  try {
    makeCommit(msg);
  } finally {
    delete process.env.GIT_AUTHOR_DATE;
    delete process.env.GIT_COMMITTER_DATE;
  }
};

test("timelineFloor is the newest shipped commit across features, ignoring work branches and main", async () => {
  await withSandbox(async () => {
    await startFeature("a", "main", false);
    makeCommit("a: real-time work commit");
    run("git", ["checkout", "a"]);
    stampedCommit("a: shipped", "2026-09-01T12:00:00+02:00");
    run("git", ["push", TEST_ORIGIN, "a"]);

    await startFeature("b", "main", false);
    run("git", ["checkout", "b"]);
    stampedCommit("b: shipped", "2026-09-03T09:30:00+02:00");

    assert.equal(
      timelineFloor()?.toISOString(),
      new Date("2026-09-03T09:30:00+02:00").toISOString(),
    );
  });
});

test("timelineFloor is null when nothing was shipped", async () => {
  await withSandbox(async () => {
    await startFeature("a", "main", false);
    makeCommit("a: work");
    assert.equal(timelineFloor(), null);
  });
});

test("editableCanvas keeps the floor day's start at the floor time", () => {
  const days = [
    { date: "2026-09-03", startMin: 14 * 60, endMin: 18 * 60 },
    { date: "2026-09-04", startMin: 8 * 60, endMin: 11 * 60 },
  ];
  const floor = new Date("2026-09-03T09:30:00");
  assert.deepEqual(editableCanvas(days, floor)[0], {
    date: "2026-09-03",
    startMin: 9 * 60 + 30,
    endMin: 18 * 60,
  });
});

test("session editor clamps the start to the floor", async () => {
  const now = { date: "2026-09-04", time: "14:30" };
  const config: SessionEditorConfig = {
    title: "t",
    subtitle: "s",
    window: { start: { date: "2026-09-03", time: "10:00" }, end: { ...now } },
    now,
    dayStartMin: 8 * 60,
    dayEndMin: 18 * 60,
    commits: 1,
    floor: { date: "2026-09-03", time: "09:30" },
  };
  const { answer, events } = await render(editSessionWindow, config);
  for (let i = 4; i > 0; i--) events.keypress("up");
  events.keypress("left");
  events.keypress("down");
  for (let i = 0; i < 4; i++) events.keypress("left");
  for (let i = 0; i < 3; i++) events.keypress("down");
  events.keypress("enter");
  const result = await answer;
  assert.deepEqual(result.action === "confirm" && result.window.start, {
    date: "2026-09-03",
    time: "09:30",
  });
});
