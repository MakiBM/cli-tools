import { test } from "vitest";
import assert from "node:assert/strict";
import { join } from "node:path";
import { setupSandbox, teardown, inDir, run, type SandboxContext } from "./helpers.js";
import { installHook, isHookInstalled } from "../src/hook-install.js";

async function withSandbox(fn: (ctx: SandboxContext) => Promise<void> | void): Promise<void> {
  const ctx = setupSandbox();
  try {
    await inDir(ctx.work, async () => fn(ctx));
  } finally {
    teardown(ctx.sandbox);
  }
}

test("hook detection resolves the shared hook from a linked worktree", async () => {
  await withSandbox(async ({ sandbox }) => {
    installHook();
    assert.ok(isHookInstalled(), "installed in the main checkout");

    const wt = join(sandbox, "wt");
    run("git", ["worktree", "add", "-b", "wtbranch", wt]);
    await inDir(wt, () => {
      assert.ok(isHookInstalled(), "detected from the worktree, not treated as unset up");
    });
  });
});
