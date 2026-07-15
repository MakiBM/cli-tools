import { test } from "vitest";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// The source tests import from src/, where the hook path math happens to work.
// The published package runs from dist/src/, a different depth - this guards that
// installHook resolves the bundled hook against the BUILT layout. Runs only when
// dist exists (CI builds before test; local `pnpm build` produces it).
const builtHookInstall = fileURLToPath(new URL("../dist/src/hook-install.js", import.meta.url));

test.runIf(existsSync(builtHookInstall))(
  "installHook resolves the bundled hook from the built dist layout",
  async () => {
    const dir = mkdtempSync(join(tmpdir(), "gites-pkg-"));
    execFileSync("git", ["init", "-q", dir]);
    const prev = process.cwd();
    process.chdir(dir);
    try {
      const { installHook } = await import(`${builtHookInstall}?t=${Date.now()}`);
      const r = installHook();
      assert.ok(existsSync(r.path), "hook installed from built dist");
    } finally {
      process.chdir(prev);
    }
  },
);
