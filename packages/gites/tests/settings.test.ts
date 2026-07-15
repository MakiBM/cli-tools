import { test } from "vitest";
import assert from "node:assert/strict";
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
import { legacyConfigPresent, migrateLegacyConfig } from "../src/migrate.js";
import { applyPrefixRename } from "../src/settings.js";
import { assertBackupRemoteDistinct } from "../src/remotes.js";
import { listWorkBranches } from "../src/feature.js";

async function withSandbox(fn: (ctx: SandboxContext) => Promise<void> | void): Promise<void> {
  const ctx = setupSandbox();
  try {
    await inDir(ctx.work, async () => fn(ctx));
  } finally {
    teardown(ctx.sandbox);
  }
}

function cfg(key: string): string {
  return run("git", ["config", "--default", "", key]).trim();
}

test("legacy gitpace config migrates into the gites namespace", async () => {
  await withSandbox(async () => {
    run("git", ["config", "--unset", "gites.remote"]);
    run("git", ["config", "gitpace.branch", "NP-1"]);
    run("git", ["config", "branch.NP-1.gitpacebase", "main"]);

    assert.ok(legacyConfigPresent());

    migrateLegacyConfig();

    assert.equal(cfg("gites.workprefix"), "gitpace-");
    assert.equal(cfg("gites.remote"), "gitpace");
    assert.equal(cfg("gites.branch"), "NP-1");
    assert.equal(cfg("branch.NP-1.gitesbase"), "main");
    assert.ok(!legacyConfigPresent(), "no longer legacy once gites.remote is set");
  });
});

test("assertBackupRemoteDistinct refuses a backup remote that points at origin", async () => {
  await withSandbox(async ({ origin }) => {
    assert.doesNotThrow(assertBackupRemoteDistinct, "distinct sandbox remotes pass");

    run("git", ["config", "gites.remote", "danger"]);
    run("git", ["remote", "add", "danger", origin]);
    assert.throws(assertBackupRemoteDistinct, /points at origin/);

    run("git", ["config", "gites.remote", TEST_ORIGIN]);
    assert.throws(assertBackupRemoteDistinct, /same as origin/);
  });
});

test("applyPrefixRename renames local + backup work branches, origin untouched", async () => {
  await withSandbox(async () => {
    run("git", ["branch", "gites-a", "main"]);
    run("git", ["branch", "gites-b", "main"]);
    run("git", ["push", TEST_REMOTE, "gites-a"]);

    await applyPrefixRename("gites-", "gp-");

    assert.ok(branchExists("gp-a") && branchExists("gp-b"), "renamed locally");
    assert.ok(!branchExists("gites-a") && !branchExists("gites-b"), "old names gone");
    assert.ok(remoteHasBranch(TEST_REMOTE, "gp-a"), "backup renamed");
    assert.ok(!remoteHasBranch(TEST_REMOTE, "gites-a"), "old backup removed");
    assert.deepEqual(listWorkBranches("gp-").sort(), ["gp-a", "gp-b"]);
    assert.ok(remoteHasBranch(TEST_ORIGIN, "main"), "origin untouched");
  });
});
