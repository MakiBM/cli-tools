import { execFileSync } from "node:child_process";
import pc from "picocolors";
import { git, getConfig, setConfig, branchExists } from "./git.js";
import { workBranch } from "./feature.js";
import { reparentWork } from "./reparent.js";
import { ensurePreCommitHook } from "./hook-install.js";
import { withSpinner } from "./spinner.js";

export const LOCK_MESSAGE = (name: string): string => `PR open for '${name}', commit on '${name}'`;

const lockKey = (name: string): string => `branch.${name}.giteslocked`;

export function isLocked(name: string): boolean {
  return getConfig(lockKey(name)) === "true";
}

export type PrState = "OPEN" | "MERGED" | "CLOSED" | "";

export function prState(name: string): PrState {
  try {
    const out = execFileSync("gh", ["pr", "view", name, "--json", "state", "-q", ".state"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    }).trim();
    return out === "OPEN" || out === "MERGED" || out === "CLOSED" ? out : "";
  } catch {
    return "";
  }
}

// Locked once a PR exists (open or merged): later work belongs on the live
// branch. When gh cannot answer, the cached state stands.
export function refreshLock(name: string, state: PrState = prState(name)): boolean {
  ensurePreCommitHook();
  if (!state) return isLocked(name);
  const locked = state !== "CLOSED";
  setConfig(lockKey(name), String(locked));
  return locked;
}

export async function unlock(name: string): Promise<void> {
  if (!branchExists(name)) throw new Error(`branch '${name}' not found.`);
  const work = workBranch(name);
  const ok = await withSpinner(`Rebasing ${work} onto ${name}`, () => reparentWork(name, work));
  if (!ok) {
    console.log(
      `Conflict rebasing '${work}' onto '${name}'. Resolve it, then re-run 'gites unlock'.`,
    );
    return;
  }
  git("config", "--unset", lockKey(name));
  console.log(pc.green(`Unlocked '${name}'. Work continues on '${work}'.`));
}
