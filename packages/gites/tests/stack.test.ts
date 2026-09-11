import { test } from "vitest";
import assert from "node:assert/strict";
import {
  setupSandbox,
  teardown,
  inDir,
  run,
  branchExists,
  remoteHasBranch,
  makeCommit,
  TEST_ORIGIN,
  type SandboxContext,
} from "./helpers.js";
import { startFeature } from "../src/start-feature.js";
import { baseRef, isLocalFeatureBase, baseBranch } from "../src/feature.js";

async function withSandbox(fn: (ctx: SandboxContext) => Promise<void> | void): Promise<void> {
  const ctx = setupSandbox();
  try {
    await inDir(ctx.work, async () => fn(ctx));
  } finally {
    teardown(ctx.sandbox);
  }
}

const tip = (ref: string): string => run("git", ["rev-parse", ref]).trim();

test("start-feature on a local unshipped feature stacks work on the parent's work branch", async () => {
  await withSandbox(async () => {
    await startFeature("a", "main", false);
    makeCommit("a: work 1");

    await startFeature("b", "a", false);

    assert.ok(branchExists("b") && branchExists("gites-b"));
    assert.equal(baseBranch("b"), "a");
    assert.equal(tip("b"), tip("a"), "live child starts at the local live parent");
    assert.equal(tip("gites-b"), tip("gites-a"), "work child starts at the parent's work tip");
    assert.ok(!remoteHasBranch(TEST_ORIGIN, "a") && !remoteHasBranch(TEST_ORIGIN, "b"));
  });
});

test("baseRef resolves a gites feature locally and everything else on origin", async () => {
  await withSandbox(async () => {
    await startFeature("a", "main", false);
    assert.equal(isLocalFeatureBase("a"), true);
    assert.equal(baseRef("a"), "a");
    assert.equal(isLocalFeatureBase("main"), false);
    assert.equal(baseRef("main"), `${TEST_ORIGIN}/main`);
  });
});

test("parentPending counts the parent's unshipped commits; shipping the child is refused until zero", async () => {
  await withSandbox(async () => {
    const { parentPending, PARENT_PENDING } = await import("../src/ship.js");
    await startFeature("a", "main", false);
    makeCommit("a: work 1");
    await startFeature("b", "a", false);
    makeCommit("b: work 1");

    assert.equal(parentPending("a"), 1);
    assert.match(PARENT_PENDING("a", 1), /ship 'a' first/);

    run("git", ["checkout", "a"]);
    run("git", ["cherry-pick", "gites-a"]);
    assert.equal(parentPending("a"), 0);
  });
});
