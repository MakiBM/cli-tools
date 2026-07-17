import { cpSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { basename, dirname, join } from "node:path";
import { git, gitTry, gitRun, getConfig } from "./git.js";
import { workBranch } from "./feature.js";

export interface Worktree {
  path: string;
  branch: string;
}

function mainRoot(): string {
  const commonDir = git("rev-parse", "--path-format=absolute", "--git-common-dir");
  return dirname(commonDir.replace(/\/$/, ""));
}

export function worktreesRoot(): string {
  const root = mainRoot();
  return join(dirname(root), `${basename(root)}.worktrees`);
}

export function worktreePath(name: string): string {
  return join(worktreesRoot(), name);
}

export function listWorktrees(): Worktree[] {
  const raw = gitTry("worktree", "list", "--porcelain");
  const out: Worktree[] = [];
  let path = "";
  let branch = "";
  for (const line of raw.split("\n")) {
    if (line.startsWith("worktree ")) {
      path = line.slice("worktree ".length);
    } else if (line.startsWith("branch ")) {
      branch = line.slice("branch ".length).replace(/^refs\/heads\//, "");
    } else if (line === "") {
      if (path) out.push({ path, branch });
      path = "";
      branch = "";
    }
  }
  if (path) out.push({ path, branch });
  return out;
}

export function worktreeForFeature(name: string): string {
  const work = workBranch(name);
  const wt = listWorktrees().find((w) => w.branch === work);
  return wt ? wt.path : "";
}

export function branchCheckedOutElsewhere(branch: string): boolean {
  return listWorktrees().some((w) => w.branch === branch && w.path !== process.cwd());
}

const SKIP_DIRS = new Set(["node_modules", ".git", "dist", "build", ".next", ".turbo", ".cache"]);

function isArtifact(name: string): boolean {
  return name === ".claude" || name.startsWith(".env");
}

// Collect artifact paths (relative to `from`) at any depth: top-level `.claude`
// plus `.env*` files nested in workspaces like `apps/shell/.env.local`.
function collectArtifacts(from: string, base: string, out: string[]): void {
  for (const entry of readdirSync(from, { withFileTypes: true })) {
    const rel = base ? join(base, entry.name) : entry.name;
    if (isArtifact(entry.name)) {
      out.push(rel);
      continue;
    }
    if (entry.isDirectory() && !SKIP_DIRS.has(entry.name)) {
      collectArtifacts(join(from, entry.name), rel, out);
    }
  }
}

export function copyLocalArtifacts(from: string, to: string): void {
  const rels: string[] = [];
  collectArtifacts(from, "", rels);
  for (const rel of rels) {
    const src = join(from, rel);
    if (!existsSync(src)) continue;
    const dst = join(to, rel);
    mkdirSync(dirname(dst), { recursive: true });
    cpSync(src, dst, { recursive: true });
  }
}

export async function addWorktree(name: string, live: string): Promise<string> {
  const path = worktreePath(name);
  await gitRun("worktree", "add", path, "-b", workBranch(name), live);
  copyLocalArtifacts(mainRoot(), path);
  return path;
}

export async function removeWorktree(path: string): Promise<void> {
  await gitRun("worktree", "remove", path);
}

export function worktreeEnabled(): boolean {
  return getConfig("gites.worktree") === "true";
}
