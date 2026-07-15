import { execFileSync } from "node:child_process";
import { checkbox, confirm } from "@inquirer/prompts";
import pc from "picocolors";
import { gitTry, gitRun, currentBranch, branchExists, remoteBranches } from "./git.js";
import { originRemote, gitesRemote, assertBackupRemoteDistinct } from "./remotes.js";
import { workBranch } from "./feature.js";
import { listWorktrees, removeWorktree } from "./worktree.js";
import { withSpinner } from "./spinner.js";

export interface Candidate {
  name: string;
  live: boolean;
  work: string;
  workLocal: boolean;
  workOnRemote: boolean;
  worktree: string;
}

export interface RepoState {
  current: string;
  dirtyWorktrees: Set<string>;
  remote: string;
}

export interface CleanupItem extends Candidate {
  blocked?: string;
  manualCmd?: string;
}

function manualCommand(item: CleanupItem, remote: string): string {
  const parts: string[] = [];
  if (item.worktree) parts.push(`git worktree remove --force "${item.worktree}"`);
  const locals = [item.workLocal ? item.work : "", item.live ? item.name : ""].filter(Boolean);
  if (locals.length) parts.push(`git branch -D ${locals.join(" ")}`);
  if (item.workOnRemote) parts.push(`git push ${remote} --delete ${item.work}`);
  return parts.join(" && ");
}

export function buildCleanupPlan(candidates: Candidate[], state: RepoState): CleanupItem[] {
  return candidates.map((c) => {
    const item: CleanupItem = { ...c };
    let blocked = "";
    if (c.worktree && state.dirtyWorktrees.has(c.worktree)) {
      blocked = "uncommitted changes in worktree";
    } else if ((c.live && c.name === state.current) || (c.workLocal && c.work === state.current)) {
      blocked = "checked out here";
    }
    if (blocked) {
      item.blocked = blocked;
      item.manualCmd = manualCommand(item, state.remote);
    }
    return item;
  });
}

function ownerRepo(origin: string): string {
  const url = gitTry("remote", "get-url", origin);
  const m = url.match(/[:/]([^/:]+\/[^/]+?)(?:\.git)?$/);
  if (!m)
    throw new Error(`could not parse owner/repo from '${origin}' remote url: ${url || "(unset)"}`);
  return m[1];
}

function ghClosedHeads(repo: string): string[] {
  try {
    return execFileSync(
      "gh",
      [
        "pr",
        "list",
        "-R",
        repo,
        "--state",
        "closed",
        "--limit",
        "1000",
        "--json",
        "headRefName",
        "--jq",
        ".[].headRefName",
      ],
      { encoding: "utf8" },
    )
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
  } catch {
    throw new Error(
      "gh CLI required for cleanup. Install with 'brew install gh', then 'gh auth login'.",
    );
  }
}

export function discoverCandidates(): Candidate[] {
  const origin = originRemote();
  const remote = gitesRemote();
  const closed = new Set(ghClosedHeads(ownerRepo(origin)));
  const onOrigin = remoteBranches(origin);
  const deleted = [...closed].filter((b) => b !== "main" && !onOrigin.has(b));

  const onRemote = remoteBranches(remote);
  const worktrees = listWorktrees();

  const out: Candidate[] = [];
  for (const name of deleted) {
    const work = workBranch(name);
    const live = branchExists(name);
    const workLocal = branchExists(work);
    const workOnRemote = onRemote.has(work);
    if (!live && !workLocal && !workOnRemote) continue;
    const wt = worktrees.find((w) => w.branch === work || w.branch === name);
    out.push({ name, live, work, workLocal, workOnRemote, worktree: wt ? wt.path : "" });
  }
  return out;
}

function repoState(candidates: Candidate[], remote: string): RepoState {
  const dirtyWorktrees = new Set<string>();
  for (const c of candidates) {
    if (c.worktree && gitTry("-C", c.worktree, "status", "--porcelain"))
      dirtyWorktrees.add(c.worktree);
  }
  return { current: currentBranch(), dirtyWorktrees, remote };
}

export async function executeItem(item: CleanupItem, remote: string): Promise<void> {
  if (item.worktree) await removeWorktree(item.worktree);
  const locals = [item.workLocal ? item.work : "", item.live ? item.name : ""].filter(Boolean);
  if (locals.length) await gitRun("branch", "-D", ...locals);
  if (item.workOnRemote) await gitRun("push", remote, "--delete", item.work);
}

function describe(p: CleanupItem): string {
  const targets: string[] = [];
  if (p.live) targets.push(p.name);
  if (p.workLocal) targets.push(p.work);
  if (p.workOnRemote) targets.push(`${p.work}@${gitesRemote()}`);
  if (p.worktree) targets.push("worktree");
  return `${p.name}  ${pc.dim(`(${targets.join(", ")})`)}`;
}

export async function cleanup(): Promise<void> {
  assertBackupRemoteDistinct();
  const remote = gitesRemote();
  const candidates = await withSpinner("Scanning origin + closed PRs", async () =>
    discoverCandidates(),
  );
  if (candidates.length === 0) {
    console.log("No finished features to clean up.");
    return;
  }

  const plan = buildCleanupPlan(candidates, repoState(candidates, remote));
  const blocked = plan.filter((p) => p.blocked);
  const deletable = plan.filter((p) => !p.blocked);

  if (blocked.length) {
    console.log(pc.yellow("Cannot auto-delete (resolve, then run the command):"));
    for (const b of blocked) {
      console.log(`  ${pc.bold(b.name)} - ${b.blocked}`);
      console.log(pc.dim(`    ${b.manualCmd}`));
    }
    console.log("");
  }

  if (deletable.length === 0) {
    console.log("Nothing to auto-delete.");
    return;
  }

  const picks = await checkbox({
    message: "Delete these finished features (origin is never touched):",
    choices: deletable.map((p) => ({ name: describe(p), value: p.name, checked: true })),
    pageSize: 20,
  });
  const chosen = deletable.filter((p) => picks.includes(p.name));
  if (chosen.length === 0) {
    console.log("Nothing selected.");
    return;
  }

  const ok = await confirm({
    message: `Delete ${chosen.length} feature(s)? Local + backup only, origin untouched.`,
    default: true,
  });
  if (!ok) {
    console.log("Aborted.");
    return;
  }

  for (const item of chosen) {
    await withSpinner(`Removing ${item.name}`, () => executeItem(item, remote));
  }
  console.log(pc.green(`Cleaned up ${chosen.length} feature(s). Origin was not touched.`));
}
