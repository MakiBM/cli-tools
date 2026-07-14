import { gitTry, branchExists, currentBranch, getConfig, setConfig } from "./git.js";

const WORK_PREFIX = "gites-";

export function baseBranch(name: string): string {
  return getConfig(`branch.${name}.gitesbase`) || "main";
}

export function setBaseBranch(name: string, base: string): void {
  setConfig(`branch.${name}.gitesbase`, base);
}

export function workBranch(name: string): string {
  return `${WORK_PREFIX}${name}`;
}

export function isWorkBranch(name: string): boolean {
  return name.startsWith(WORK_PREFIX);
}

export function stripWorkPrefix(name: string): string {
  return name.slice(WORK_PREFIX.length);
}

export function listFeatures(): string[] {
  const refs = gitTry("for-each-ref", "--format=%(refname:short)", `refs/heads/${WORK_PREFIX}*`)
    .split("\n")
    .filter(Boolean);
  const out: string[] = [];
  for (const ref of refs) {
    const name = stripWorkPrefix(ref);
    if (branchExists(name)) out.push(name);
  }
  return out;
}

export function activeFeature(): string {
  const head = currentBranch();
  if (isWorkBranch(head)) {
    const name = stripWorkPrefix(head);
    if (branchExists(name)) return name;
  }
  if (head && head !== "main" && branchExists(workBranch(head))) {
    return head;
  }
  const cfg = getConfig("gites.branch");
  if (cfg && branchExists(cfg) && branchExists(workBranch(cfg))) return cfg;
  return "";
}

export function canAttach(): boolean {
  const head = currentBranch();
  if (!head) return false;
  if (head === "main") return false;
  if (isWorkBranch(head)) return false;
  if (branchExists(workBranch(head))) return false;
  return true;
}

export interface ResolvedLive {
  live: string;
  head: string;
}

export function resolveLiveBranch(): ResolvedLive {
  const head = currentBranch();
  if (isWorkBranch(head) && branchExists(stripWorkPrefix(head))) {
    return { live: stripWorkPrefix(head), head };
  }
  if (head && head !== "main" && branchExists(workBranch(head))) {
    return { live: head, head };
  }
  const cfg = getConfig("gites.branch");
  return { live: cfg, head };
}
