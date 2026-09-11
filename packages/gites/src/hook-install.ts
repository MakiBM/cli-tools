import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, copyFileSync, chmodSync, readFileSync } from "node:fs";
import { git, gitTry } from "./git.js";

type HookName = "pre-push" | "pre-commit";

const hookMarker = (hook: HookName): string => `# gites ${hook} hook`;

// `hooks/<name>` ships at the package root (files: ["dist","hooks"]). The
// compiled module sits at dist/src/, so root is two levels up; from TS source
// it is one level up. Resolve against whichever exists.
function hookSrc(hook: HookName): string {
  const here = dirname(fileURLToPath(import.meta.url));
  for (const up of ["..", join("..", "..")]) {
    const candidate = join(here, up, "hooks", hook);
    if (existsSync(candidate)) return candidate;
  }
  throw new Error(`gites: bundled ${hook} hook not found`);
}

export interface HookInstall {
  path: string;
  underHooksPath: boolean;
  replacedExisting: boolean;
  backupPath?: string;
}

function hookTargetPath(hook: HookName): { path: string; underHooksPath: boolean } {
  const hooksPath = gitTry("config", "core.hooksPath");
  if (hooksPath) {
    return { path: join(hooksPath, hook), underHooksPath: true };
  }
  // Use the common dir, not --git-dir: in a linked worktree --git-dir is the
  // per-worktree dir (.git/worktrees/<name>), but git runs hooks from the shared
  // .git/hooks. Resolving there keeps hook detection stable across worktrees.
  const commonDir = git("rev-parse", "--path-format=absolute", "--git-common-dir");
  return { path: join(commonDir, "hooks", hook), underHooksPath: false };
}

function isOurHook(path: string, hook: HookName): boolean {
  if (!existsSync(path)) return false;
  try {
    return readFileSync(path, "utf8").includes(hookMarker(hook));
  } catch {
    return false;
  }
}

export function isHookInstalled(hook: HookName = "pre-push"): boolean {
  return isOurHook(hookTargetPath(hook).path, hook);
}

function installOne(hook: HookName): HookInstall {
  const target = hookTargetPath(hook);
  mkdirSync(dirname(target.path), { recursive: true });

  let backupPath: string | undefined;
  const replacedExisting = existsSync(target.path) && !isOurHook(target.path, hook);
  if (replacedExisting) {
    backupPath = `${target.path}.pre-gites`;
    if (!existsSync(backupPath)) {
      copyFileSync(target.path, backupPath);
    }
  }

  copyFileSync(hookSrc(hook), target.path);
  chmodSync(target.path, 0o755);
  return {
    path: target.path,
    underHooksPath: target.underHooksPath,
    replacedExisting,
    backupPath,
  };
}

// Installs both hooks; the returned details describe pre-push (the one setup
// reports on). pre-commit enforces the PR lock and is refreshed the same way.
export function installHook(): HookInstall {
  installOne("pre-commit");
  return installOne("pre-push");
}

export function ensurePreCommitHook(): void {
  if (!isHookInstalled("pre-commit")) installOne("pre-commit");
}
