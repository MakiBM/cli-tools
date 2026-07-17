import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { copyLocalArtifacts } from "../src/worktree.js";

function write(root: string, rel: string, content: string): void {
  const p = join(root, rel);
  mkdirSync(join(p, ".."), { recursive: true });
  writeFileSync(p, content);
}

test("copyLocalArtifacts copies nested .env files and skips vendored dirs", () => {
  const from = mkdtempSync(join(tmpdir(), "gites-src-"));
  const to = mkdtempSync(join(tmpdir(), "gites-dst-"));
  try {
    write(from, ".env", "ROOT\n");
    write(from, "apps/shell/.env.local", "SHELL\n");
    write(from, "packages/api/.env.production", "API\n");
    write(from, "node_modules/pkg/.env", "SKIP\n");
    write(from, ".claude/settings.json", "{}\n");

    copyLocalArtifacts(from, to);

    assert.equal(readFileSync(join(to, ".env"), "utf8"), "ROOT\n");
    assert.equal(readFileSync(join(to, "apps/shell/.env.local"), "utf8"), "SHELL\n");
    assert.equal(readFileSync(join(to, "packages/api/.env.production"), "utf8"), "API\n");
    assert.ok(existsSync(join(to, ".claude/settings.json")));
    assert.ok(!existsSync(join(to, "node_modules")), "vendored dirs are not walked");
  } finally {
    rmSync(from, { recursive: true, force: true });
    rmSync(to, { recursive: true, force: true });
  }
});
