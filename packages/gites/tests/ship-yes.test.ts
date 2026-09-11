import { test } from "vitest";
import assert from "node:assert/strict";
import {
  setupSandbox,
  teardown,
  inDir,
  run,
  makeCommit,
  remoteHasBranch,
  TEST_ORIGIN,
  type SandboxContext,
} from "./helpers.js";
import { startFeature } from "../src/start-feature.js";
import { ship } from "../src/ship.js";

async function withSandbox(fn: (ctx: SandboxContext) => Promise<void> | void): Promise<void> {
  const ctx = setupSandbox();
  try {
    await inDir(ctx.work, async () => fn(ctx));
  } finally {
    teardown(ctx.sandbox);
  }
}

test("ship --yes ships every pending commit with ascending past timestamps and pushes live", async () => {
  await withSandbox(async () => {
    await startFeature("a", "main", false);
    makeCommit("first");
    makeCommit("second");

    await ship({ yes: true });

    const shipped = run("git", ["log", "--format=%s|%cI", "main..a"]).trim().split("\n");
    assert.deepEqual(
      shipped.map((l) => l.split("|")[0]),
      ["second", "first"],
    );
    const stamps = shipped.map((l) => new Date(l.split("|")[1]!).getTime()).reverse();
    assert.ok(stamps[0]! < stamps[1]!, "timestamps ascend");
    assert.ok(stamps[1]! <= Date.now(), "nothing in the future");
    assert.ok(remoteHasBranch(TEST_ORIGIN, "a"));
    assert.equal(run("git", ["symbolic-ref", "--short", "HEAD"]).trim(), "gites-a");
  });
});
