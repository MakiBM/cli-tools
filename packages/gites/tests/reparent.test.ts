import { test } from "vitest";
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { setupSandbox, teardown, inDir, run, type SandboxContext } from "./helpers.js";
import { workCutPoint } from "../src/reparent.js";

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

// Reproduces the PR-chain failure: parent A is squash-merged onto live, while the
// child work branch still carries A's original commits. workCutPoint must return
// the parent segment's tip so ship can strip it via `rebase --onto`.
test("workCutPoint finds the squash-merged parent boundary", async () => {
  await withSandbox(() => {
    // parent A: two commits on a work branch
    run("git", ["checkout", "-b", "gites-a"]);
    commitFile("a1.txt", "a1\n", "A: first");
    const aTip = commitFile("a2.txt", "a2\n", "A: second");

    // child B forks off A's originals and adds its own commit
    run("git", ["checkout", "-b", "gites-b"]);
    const bCommit = commitFile("b1.txt", "b1\n", "B: first");

    // live for B = main + A squashed into one commit (new SHA, same tree as aTip)
    run("git", ["checkout", "-b", "b", "main"]);
    run("git", ["read-tree", aTip]);
    run("git", ["checkout-index", "-a", "-f"]);
    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", "A: squashed"]);

    const cut = workCutPoint("b", "gites-b");
    assert.equal(cut, aTip, "cut should be the parent segment tip already on live");
    assert.notEqual(cut, bCommit, "child commit must not be stripped");
  });
});

test("workCutPoint returns null when nothing is already merged", async () => {
  await withSandbox(() => {
    run("git", ["checkout", "-b", "feat", "main"]);
    run("git", ["checkout", "-b", "gites-feat"]);
    commitFile("x.txt", "x\n", "feat: work");
    assert.equal(workCutPoint("feat", "gites-feat"), null);
  });
});

// End-to-end: `rebase --onto live <cut> work` yields a clean, conflict-free range.
test("rebase --onto cut strips the parent with no conflict", async () => {
  await withSandbox(() => {
    run("git", ["checkout", "-b", "gites-a"]);
    commitFile("a1.txt", "a1\n", "A: first");
    const aTip = commitFile("a2.txt", "a2\n", "A: second");

    run("git", ["checkout", "-b", "gites-b"]);
    commitFile("b1.txt", "b1\n", "B: first");

    run("git", ["checkout", "-b", "b", "main"]);
    run("git", ["read-tree", aTip]);
    run("git", ["checkout-index", "-a", "-f"]);
    run("git", ["add", "-A"]);
    run("git", ["commit", "-m", "A: squashed"]);

    const cut = workCutPoint("b", "gites-b");
    assert.ok(cut);
    run("git", ["checkout", "gites-b"]);
    run("git", ["rebase", "--onto", "b", cut!, "gites-b"]);

    const shipRange = run("git", ["log", "--format=%s", "b..gites-b"]).trim().split("\n");
    assert.deepEqual(shipRange, ["B: first"], "only the child commit remains to ship");
  });
});
