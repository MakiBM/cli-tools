import { test } from "vitest";
import assert from "node:assert/strict";
import {
  setupSandbox,
  teardown,
  inDir,
  run,
  runTry,
  branchExists,
  remoteHasBranch,
  makeCommit,
  teammatePush,
  TEST_ORIGIN,
  TEST_REMOTE,
  type SandboxContext,
} from "./helpers.js";
import type { SetupOptions } from "../src/setup.js";

async function withSandbox(fn: (ctx: SandboxContext) => Promise<void> | void): Promise<void> {
  const ctx = setupSandbox();
  try {
    await inDir(ctx.work, async () => fn(ctx));
  } finally {
    teardown(ctx.sandbox);
  }
}

async function importFresh<T = unknown>(mod: string): Promise<T> {
  const nonce = `${Date.now()}${Math.round(Math.random() * 1e9)}`;
  const url = new URL(`../src/${mod}`, import.meta.url).href + `?t=${nonce}`;
  return import(url) as Promise<T>;
}

function setupOpts(): SetupOptions {
  return { originName: TEST_ORIGIN, remoteName: TEST_REMOTE };
}

test("setup adds remote + installs hook without touching hooksPath/pushDefault/alias", async () => {
  await withSandbox(async ({ remote, work }) => {
    run("git", ["remote", "remove", TEST_REMOTE]);
    const { runSetup } = await importFresh<typeof import("../src/setup.js")>("setup.ts");
    runSetup(remote, setupOpts());

    assert.equal(run("git", ["remote", "get-url", TEST_REMOTE]).trim(), remote);

    const { readFileSync, existsSync } = await import("node:fs");
    const hookPath = `${work}/.git/hooks/pre-push`;
    assert.ok(existsSync(hookPath), "pre-push hook should be installed");
    assert.match(readFileSync(hookPath, "utf8"), /gites pre-push hook/);

    assert.equal(run("git", ["config", "--default", "", "core.hooksPath"]).trim(), "");
    assert.equal(run("git", ["config", "--default", "", "remote.pushDefault"]).trim(), "");
    assert.equal(run("git", ["config", "--default", "", "alias.sync"]).trim(), "");
  });
});

test("start-feature creates feature + gites-<name>, defers origin push until ship", async () => {
  await withSandbox(async ({ remote }) => {
    run("git", ["remote", "remove", TEST_REMOTE]);
    const { runSetup } = await importFresh<typeof import("../src/setup.js")>("setup.ts");
    runSetup(remote, setupOpts());
    const { startFeature } =
      await importFresh<typeof import("../src/start-feature.js")>("start-feature.ts");
    await startFeature("feature-x");

    assert.ok(branchExists("feature-x"));
    assert.ok(branchExists("gites-feature-x"));
    assert.equal(run("git", ["symbolic-ref", "--short", "HEAD"]).trim(), "gites-feature-x");
    assert.equal(run("git", ["config", "gites.branch"]).trim(), "feature-x");
    assert.equal(run("git", ["config", "branch.feature-x.gitesbase"]).trim(), "main");
    assert.ok(!remoteHasBranch(TEST_ORIGIN, "feature-x"), "live branch stays local until ship");
    assert.ok(remoteHasBranch(TEST_REMOTE, "gites-feature-x"));
  });
});

test("start-feature --worktree creates a worktree, leaves main checked out", async () => {
  await withSandbox(async ({ remote, work }) => {
    run("git", ["remote", "remove", TEST_REMOTE]);
    const { runSetup } = await importFresh<typeof import("../src/setup.js")>("setup.ts");
    runSetup(remote, setupOpts());
    const { startFeature } =
      await importFresh<typeof import("../src/start-feature.js")>("start-feature.ts");
    await startFeature("wt", "main", true);

    assert.ok(branchExists("wt"));
    assert.ok(branchExists("gites-wt"));
    assert.equal(
      run("git", ["symbolic-ref", "--short", "HEAD"]).trim(),
      "main",
      "main HEAD untouched",
    );

    const { worktreeForFeature } =
      await importFresh<typeof import("../src/worktree.js")>("worktree.ts");
    const path = worktreeForFeature("wt");
    assert.ok(path.endsWith("/work.worktrees/wt"), `unexpected worktree path: ${path}`);
    const { existsSync, realpathSync } = await import("node:fs");
    assert.equal(realpathSync(path), realpathSync(`${work}.worktrees/wt`));
    assert.ok(existsSync(path), "worktree dir should exist");
    assert.equal(run("git", ["-C", path, "symbolic-ref", "--short", "HEAD"]).trim(), "gites-wt");
    assert.ok(!remoteHasBranch(TEST_ORIGIN, "wt"), "live branch stays local until ship");
    assert.ok(remoteHasBranch(TEST_REMOTE, "gites-wt"));
  });
});

test("start-feature rejects duplicate name", async () => {
  await withSandbox(async ({ remote }) => {
    run("git", ["remote", "remove", TEST_REMOTE]);
    const { runSetup } = await importFresh<typeof import("../src/setup.js")>("setup.ts");
    runSetup(remote, setupOpts());
    const { startFeature } =
      await importFresh<typeof import("../src/start-feature.js")>("start-feature.ts");
    await startFeature("dup");
    await assert.rejects(() => startFeature("dup"), /already exists/);
  });
});

test("attach adopts existing origin branch", async () => {
  await withSandbox(async ({ remote }) => {
    run("git", ["remote", "remove", TEST_REMOTE]);
    const { runSetup } = await importFresh<typeof import("../src/setup.js")>("setup.ts");
    runSetup(remote, setupOpts());

    run("git", ["checkout", "-b", "existing-feat"]);
    run("git", ["push", "-u", TEST_ORIGIN, "existing-feat"]);

    const { attach } = await importFresh<typeof import("../src/attach.js")>("attach.ts");
    await attach();

    assert.ok(branchExists("gites-existing-feat"));
    assert.equal(run("git", ["symbolic-ref", "--short", "HEAD"]).trim(), "gites-existing-feat");
    assert.equal(run("git", ["config", "gites.branch"]).trim(), "existing-feat");
    assert.ok(remoteHasBranch(TEST_REMOTE, "gites-existing-feat"));
  });
});

test("attach refuses on main", async () => {
  await withSandbox(async () => {
    const { attach } = await importFresh<typeof import("../src/attach.js")>("attach.ts");
    await assert.rejects(() => attach(), /cannot attach from 'main'/);
  });
});

test("resync fast-forwards main and rebases working branches", async () => {
  await withSandbox(async ({ remote, origin, sandbox }) => {
    run("git", ["remote", "remove", TEST_REMOTE]);
    const { runSetup } = await importFresh<typeof import("../src/setup.js")>("setup.ts");
    runSetup(remote, setupOpts());
    const { startFeature } =
      await importFresh<typeof import("../src/start-feature.js")>("start-feature.ts");
    await startFeature("feat-r");
    makeCommit("local work");

    teammatePush(origin, sandbox);

    const { resync } = await importFresh<typeof import("../src/resync.js")>("resync.ts");
    await resync();

    const log = run("git", ["log", "--format=%s", "main"]).trim();
    assert.match(log, /teammate commit/);
    assert.equal(run("git", ["symbolic-ref", "--short", "HEAD"]).trim(), "gites-feat-r");
  });
});

test("feature discovery lists pairs and active", async () => {
  await withSandbox(async ({ remote }) => {
    run("git", ["remote", "remove", TEST_REMOTE]);
    const { runSetup } = await importFresh<typeof import("../src/setup.js")>("setup.ts");
    runSetup(remote, setupOpts());
    const { startFeature } =
      await importFresh<typeof import("../src/start-feature.js")>("start-feature.ts");
    await startFeature("a");
    await startFeature("b");

    const { listFeatures, activeFeature } =
      await importFresh<typeof import("../src/feature.js")>("feature.ts");
    const features = listFeatures().sort();
    assert.deepEqual(features, ["a", "b"]);
    assert.equal(activeFeature(), "b");
  });
});

test("pre-push hook blocks gites-* to origin", async () => {
  await withSandbox(async ({ remote }) => {
    run("git", ["remote", "remove", TEST_REMOTE]);
    const { runSetup } = await importFresh<typeof import("../src/setup.js")>("setup.ts");
    runSetup(remote, setupOpts());
    const { startFeature } =
      await importFresh<typeof import("../src/start-feature.js")>("start-feature.ts");
    await startFeature("blockme");
    const r = runTry("git", ["push", TEST_ORIGIN, "gites-blockme"]);
    assert.notEqual(r.status, 0);
    assert.match(String(r.stderr) + String(r.stdout), /BLOCKED/);
  });
});
