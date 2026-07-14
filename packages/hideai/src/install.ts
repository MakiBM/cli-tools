import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import {
  existsSync,
  mkdirSync,
  copyFileSync,
  chmodSync,
  readFileSync,
  writeFileSync,
} from "node:fs";
import { execFileSync, spawnSync } from "node:child_process";
import pc from "picocolors";
import { formatBlockList, parseBlockList } from "./blocklist.js";

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const HOOK_SRC = join(PKG_ROOT, "hook", "commit-msg");

interface HookTarget {
  path: string;
  underHooksPath: boolean;
}

function gitTry(...args: string[]): string {
  try {
    return execFileSync("git", args, {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).replace(/\n$/, "");
  } catch {
    return "";
  }
}

function git(...args: string[]): string {
  return execFileSync("git", args, { encoding: "utf8" }).replace(/\n$/, "");
}

function repoRoot(): string {
  if (spawnSync("git", ["rev-parse", "--is-inside-work-tree"], { stdio: "ignore" }).status !== 0) {
    throw new Error("not inside a git repo");
  }
  return git("rev-parse", "--show-toplevel");
}

function hookTarget(): HookTarget {
  const hooksPath = gitTry("config", "core.hooksPath");
  if (hooksPath) {
    return { path: join(hooksPath, "commit-msg"), underHooksPath: true };
  }
  const gitDir = git("rev-parse", "--git-dir");
  return { path: join(gitDir, "hooks", "commit-msg"), underHooksPath: false };
}

function looksLikeHideaiHook(path: string): boolean {
  if (!existsSync(path)) return false;
  try {
    const content = readFileSync(path, "utf8");
    return content.includes("hideai commit-msg hook");
  } catch {
    return false;
  }
}

export function installHook(): { path: string; underHooksPath: boolean; replaced: boolean } {
  repoRoot();
  const target = hookTarget();
  mkdirSync(dirname(target.path), { recursive: true });

  const replaced = existsSync(target.path) && !looksLikeHideaiHook(target.path);
  if (replaced) {
    const backup = `${target.path}.pre-hideai`;
    if (!existsSync(backup)) {
      copyFileSync(target.path, backup);
      console.log(pc.dim(`  Backed up existing hook to ${backup}`));
    }
  }

  copyFileSync(HOOK_SRC, target.path);
  chmodSync(target.path, 0o755);
  return { path: target.path, underHooksPath: target.underHooksPath, replaced };
}

export function setBlockList(keys: string[]): void {
  if (keys.length === 0) {
    git("config", "--unset", "hideai.block");
    return;
  }
  git("config", "hideai.block", formatBlockList(keys));
}

export function getBlockList(): string[] {
  return parseBlockList(gitTry("config", "hideai.block"));
}

export function uninstallHook(): { removed: boolean; path: string } {
  const target = hookTarget();
  if (!existsSync(target.path)) return { removed: false, path: target.path };
  if (!looksLikeHideaiHook(target.path)) {
    throw new Error(`hook at ${target.path} does not look like hideai's. Leaving it alone.`);
  }
  const backup = `${target.path}.pre-hideai`;
  if (existsSync(backup)) {
    copyFileSync(backup, target.path);
    console.log(pc.dim(`  Restored prior hook from ${backup}`));
  } else {
    writeFileSync(target.path, "");
    chmodSync(target.path, 0o755);
    // Easier: remove the file. But some systems may have stale references — leaving an empty hook is safe.
  }
  gitTry("config", "--unset", "hideai.block");
  return { removed: true, path: target.path };
}
