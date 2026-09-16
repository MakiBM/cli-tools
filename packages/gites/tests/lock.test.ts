import { test } from "vitest";
import assert from "node:assert/strict";
import { join } from "node:path";
import { chmodSync, mkdirSync, writeFileSync } from "node:fs";
import {
  setupSandbox,
  teardown,
  inDir,
  run,
  runTry,
  makeCommit,
  type SandboxContext,
} from "./helpers.js";
import { startFeature } from "../src/start-feature.js";
import { isLocked, refreshLock, unlock, LOCK_MESSAGE } from "../src/lock.js";
import { installHook, isHookInstalled } from "../src/hook-install.js";

async function withSandbox(fn: (ctx: SandboxContext) => Promise<void> | void): Promise<void> {
  const ctx = setupSandbox();
  try {
    await inDir(ctx.work, async () => fn(ctx));
  } finally {
    teardown(ctx.sandbox);
  }
}

test("refreshLock locks on OPEN and MERGED, unlocks on CLOSED, keeps state when gh is silent", async () => {
  await withSandbox(async () => {
    await startFeature("a", "main", false);
    assert.equal(refreshLock("a", "OPEN"), true);
    assert.equal(isLocked("a"), true);
    assert.equal(refreshLock("a", ""), true);
    assert.equal(refreshLock("a", "CLOSED"), false);
    assert.equal(refreshLock("a", "MERGED"), true);
    assert.ok(isHookInstalled("pre-commit"), "refresh installs the pre-commit hook");
  });
});

test("pre-commit hook refuses commits on a locked work branch and allows the live branch", async () => {
  await withSandbox(async ({ work }) => {
    await startFeature("a", "main", false);
    installHook();
    refreshLock("a", "OPEN");

    const attempt = (): ReturnType<typeof runTry> => {
      run("git", ["commit", "--allow-empty", "-m", "probe", "--no-verify"]);
      run("git", ["reset", "--hard", "HEAD~1"]);
      return runTry("git", ["commit", "--allow-empty", "-m", "probe"], { cwd: work });
    };

    const onWork = attempt();
    assert.equal(onWork.status, 1);
    assert.match(onWork.stdout + onWork.stderr, /PR open for 'a', commit on 'a'/);

    run("git", ["checkout", "a"]);
    assert.equal(attempt().status, 0);
  });
});

function fakeGh(sandbox: string, state: string): NodeJS.ProcessEnv {
  const bin = join(sandbox, "bin");
  mkdirSync(bin, { recursive: true });
  const gh = join(bin, "gh");
  writeFileSync(gh, state ? `#!/bin/sh\necho ${state}\n` : "#!/bin/sh\nexit 1\n");
  chmodSync(gh, 0o755);
  return { ...process.env, PATH: `${bin}:${process.env.PATH}` };
}

function probeCommit(work: string, env: NodeJS.ProcessEnv): ReturnType<typeof runTry> {
  return runTry("git", ["commit", "--allow-empty", "-m", "probe"], { cwd: work, env });
}

test("pre-commit hook asks GitHub when no lock is cached and caches an open PR", async () => {
  await withSandbox(async ({ sandbox, work }) => {
    await startFeature("a", "main", false);
    installHook();

    const result = probeCommit(work, fakeGh(sandbox, "OPEN"));

    assert.equal(result.status, 1);
    assert.match(result.stdout + result.stderr, /PR open for 'a', commit on 'a'/);
    assert.equal(isLocked("a"), true);
  });
});

test("pre-commit hook allows the commit when GitHub has no PR or cannot answer", async () => {
  await withSandbox(async ({ sandbox, work }) => {
    await startFeature("a", "main", false);
    installHook();

    assert.equal(probeCommit(work, fakeGh(sandbox, "")).status, 0);
    assert.equal(probeCommit(work, fakeGh(sandbox, "CLOSED")).status, 0);
    assert.equal(isLocked("a"), false);
  });
});

test("pre-commit hook respects an explicit unlock without asking GitHub", async () => {
  await withSandbox(async ({ sandbox, work }) => {
    await startFeature("a", "main", false);
    installHook();
    refreshLock("a", "OPEN");
    await unlock("a");

    assert.equal(probeCommit(work, fakeGh(sandbox, "OPEN")).status, 0);
  });
});

test("unlock rebases work onto live and clears the lock", async () => {
  await withSandbox(async () => {
    await startFeature("a", "main", false);
    makeCommit("work 1");
    run("git", ["checkout", "a"]);
    writeFileSync(join(process.cwd(), "fix.txt"), "fix\n");
    run("git", ["add", "fix.txt"]);
    run("git", ["commit", "-m", "live fix"]);
    refreshLock("a", "OPEN");

    await unlock("a");

    assert.equal(isLocked("a"), false);
    assert.equal(run("git", ["merge-base", "--is-ancestor", "a", "gites-a"]).length, 0);
    assert.match(LOCK_MESSAGE("a"), /commit on 'a'/);
  });
});
