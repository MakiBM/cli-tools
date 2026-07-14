import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { existsSync, mkdirSync, copyFileSync, chmodSync, readFileSync } from "node:fs";
import { git, gitTry } from "./git.js";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const HOOK_SRC = join(PKG_ROOT, "hooks", "pre-push");
const HOOK_MARKER = "# gites pre-push hook";

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
  const gitDir = git("rev-parse", "--git-dir");
  return { path: join(gitDir, "hooks", "pre-push"), underHooksPath: false };
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

  copyFileSync(HOOK_SRC, target.path);
  chmodSync(target.path, 0o755);
  return {
    path: target.path,
    underHooksPath: target.underHooksPath,
    replacedExisting,
    backupPath,
  };
}
