import { test } from "vitest";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupSandbox, teardown, inDir, run, type SandboxContext } from "./helpers.js";
import { workDivergedFromLive, shipCandidateShas } from "../src/ship.js";

async function withSandbox(fn: (ctx: SandboxContext) => Promise<void> | void): Promise<void> {
  const ctx = setupSandbox();
  try {
    await inDir(ctx.work, async () => fn(ctx));
  } finally {
    teardown(ctx.sandbox);
  }
}

function commitFile(name: string, content: string, msg: string): string {
  writeFileSync(join(process.cwd(), name), content);
  run("git", ["add", name]);
  run("git", ["commit", "-m", msg]);
  return run("git", ["rev-parse", "HEAD"]).trim();
}

// Guard for the incident: `work` rewritten (rebased) after a ship so `live` is no
// longer an ancestor - its commits would cherry-pick against the wrong base.
test("workDivergedFromLive: false when work descends from live, true after a rewrite", async () => {
  await withSandbox(() => {
    run("git", ["checkout", "-b", "feat", "main"]);
    commitFile("live1.txt", "1\n", "live: c1");
    run("git", ["checkout", "-b", "gites-feat"]);
    commitFile("work1.txt", "w\n", "work: c1");

    assert.equal(workDivergedFromLive("feat", "gites-feat"), false);

    // Rebase work off live's tip → live no longer in work's ancestry.
    run("git", ["rebase", "--onto", "main", "feat", "gites-feat"]);
    assert.equal(workDivergedFromLive("feat", "gites-feat"), true);
  });
});

// A commit already shipped (cherry-picked to live, new SHA, same patch-id) must not
// be re-listed for shipping.
test("shipCandidateShas: drops commits already on live by patch-id", async () => {
  await withSandbox(() => {
    run("git", ["checkout", "-b", "feat", "main"]);
    run("git", ["checkout", "-b", "gites-feat"]);
    const c1 = commitFile("a.txt", "A\n", "add a");
    commitFile("b.txt", "B\n", "add b");

    run("git", ["checkout", "feat"]);
    run("git", ["cherry-pick", c1]); // ship "add a" as a new SHA on live

    const cands = shipCandidateShas("feat", "gites-feat");
    assert.equal(cands.length, 1, "only the unshipped commit remains");
    assert.equal(run("git", ["log", "-1", "--format=%s", cands[0]!]).trim(), "add b");
  });
});
