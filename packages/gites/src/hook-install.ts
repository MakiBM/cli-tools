import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, copyFileSync, chmodSync, readFileSync } from "node:fs";
import { git, gitTry } from "./git.js";

const HOOK_MARKER = "# gites pre-push hook";

// `hooks/pre-push` ships at the package root (files: ["dist","hooks"]). The
// compiled module sits at dist/src/, so root is two levels up; from TS source
// it is one level up. Resolve against whichever exists.
function hookSrc(): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const up of ["..", join("..", "..")]) {
    const candidate = join(here, up, "hooks", "pre-push");
    if (existsSync(candidate)) return candidate;
  }
  throw new Error("gites: bundled pre-push hook not found");
}

export interface HookInstall {
  path: string;
  underHooksPath: boolean;
  replacedExisting: boolean;
  backupPath?: string;
}

function hookTargetPath(): { path: string; underHooksPath: boolean } {
  const hooksPath = gitTry("config", "core.hooksPath");
  if (hooksPath) {
    return { path: join(hooksPath, "pre-push"), underHooksPath: true };
  }
  // Use the common dir, not --git-dir: in a linked worktree --git-dir is the
  // per-worktree dir (.git/worktrees/<name>), but git runs hooks from the shared
  // .git/hooks. Resolving there keeps hook detection stable across worktrees.
  const commonDir = git("rev-parse", "--path-format=absolute", "--git-common-dir");
  return { path: join(commonDir, "hooks", "pre-push"), underHooksPath: false };
}

function isOurHook(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    return readFileSync(path, "utf8").includes(HOOK_MARKER);
  } catch {
    return false;
  }
}

export function isHookInstalled(): boolean {
  return isOurHook(hookTargetPath().path);
}

export function installHook(): HookInstall {
  const target = hookTargetPath();
  mkdirSync(dirname(target.path), { recursive: true });

  let backupPath: string | undefined;
  const replacedExisting = existsSync(target.path) && !isOurHook(target.path);
  if (replacedExisting) {
    backupPath = `${target.path}.pre-gites`;
    if (!existsSync(backupPath)) {
      copyFileSync(target.path, backupPath);
    }
  }

  copyFileSync(hookSrc(), target.path);
  chmodSync(target.path, 0o755);
  return {
    path: target.path,
    underHooksPath: target.underHooksPath,
    replacedExisting,
    backupPath,
  };
}
