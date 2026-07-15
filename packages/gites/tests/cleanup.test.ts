import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import {
  setupSandbox,
  teardown,
  inDir,
  run,
  branchExists,
  remoteHasBranch,
  TEST_ORIGIN,
  TEST_REMOTE,
  type SandboxContext,
} from "./helpers.js";
import { buildCleanupPlan, executeItem, type Candidate } from "../src/cleanup.js";

async function withSandbox(fn: (ctx: SandboxContext) => Promise<void> | void): Promise<void> {
  const ctx = setupSandbox();
  try {
    await inDir(ctx.work, async () => fn(ctx));
  } finally {
    teardown(ctx.sandbox);
  }
}

function candidate(over: Partial<Candidate> = {}): Candidate {
  return {
    name: "feat",
    live: true,
    work: "gites-feat",
    workLocal: true,
    workOnRemote: true,
    worktree: "",
    ...over,
  };
}

test("buildCleanupPlan blocks a dirty worktree with a manual command", () => {
  const c = candidate({ worktree: "/tmp/wt/feat" });
  const [item] = buildCleanupPlan([c], {
    current: "main",
    dirtyWorktrees: new Set(["/tmp/wt/feat"]),
    remote: "gites",
  });
  assert.equal(item.blocked, "uncommitted changes in worktree");
  assert.match(item.manualCmd!, /git worktree remove --force "\/tmp\/wt\/feat"/);
  assert.match(item.manualCmd!, /git branch -D gites-feat feat/);
  assert.match(item.manualCmd!, /git push gites --delete gites-feat/);
});

test("buildCleanupPlan blocks a checked-out branch", () => {
  const [item] = buildCleanupPlan([candidate()], {
    current: "feat",
    dirtyWorktrees: new Set(),
    remote: "gites",
  });
  assert.equal(item.blocked, "checked out here");
});

test("buildCleanupPlan leaves a clean feature deletable", () => {
  const [item] = buildCleanupPlan([candidate({ worktree: "/tmp/wt/feat" })], {
    current: "main",
    dirtyWorktrees: new Set(),
    remote: "gites",
  });
  assert.equal(item.blocked, undefined);
});

test("executeItem deletes local live + work + backup remote, origin untouched", async () => {
  await withSandbox(async () => {
    run("git", ["branch", "feat", "main"]);
    run("git", ["branch", "gites-feat", "main"]);
    run("git", ["push", TEST_REMOTE, "gites-feat"]);

    assert.ok(branchExists("feat"));
    assert.ok(remoteHasBranch(TEST_REMOTE, "gites-feat"));

    await executeItem(candidate(), TEST_REMOTE);

    assert.ok(!branchExists("feat"), "local live deleted");
    assert.ok(!branchExists("gites-feat"), "local work deleted");
    assert.ok(!remoteHasBranch(TEST_REMOTE, "gites-feat"), "backup work deleted");
    assert.ok(remoteHasBranch(TEST_ORIGIN, "main"), "origin untouched");
  });
});

test("executeItem removes the feature worktree", async () => {
  await withSandbox(async ({ sandbox }) => {
    const wtPath = join(sandbox, "wt-feat");
    run("git", ["worktree", "add", wtPath, "-b", "gites-feat", "main"]);
    assert.ok(existsSync(wtPath));

    await executeItem(
      candidate({ live: false, workOnRemote: false, worktree: wtPath }),
      TEST_REMOTE,
    );

    assert.ok(!existsSync(wtPath), "worktree removed");
    assert.ok(!branchExists("gites-feat"), "work branch deleted");
  });
});
