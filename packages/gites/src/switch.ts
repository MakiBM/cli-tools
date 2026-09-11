import { select } from "@inquirer/prompts";
import { git, gitRun } from "./git.js";
import { listFeatures, workBranch } from "./feature.js";
import { worktreeForFeature } from "./worktree.js";
import { refreshLock, LOCK_MESSAGE } from "./lock.js";

export async function switchFeature(): Promise<void> {
  const features = listFeatures();
  if (features.length === 0) {
    throw new Error("No gites-managed features found.");
  }

  const pick = await select({
    message: "Switch to feature",
    choices: features.map((f) => ({
      name: worktreeForFeature(f) ? `${f} (worktree)` : f,
      value: f,
    })),
  });

  const locked = refreshLock(pick);
  const target = locked ? pick : workBranch(pick);
  if (locked) console.log(LOCK_MESSAGE(pick));

  const path = worktreeForFeature(pick);
  if (path) {
    console.log(`'${pick}' lives in its own worktree. cd into it:`);
    console.log(`  ${path}`);
    if (locked) await gitRun("-C", path, "checkout", target);
    return;
  }

  await gitRun("checkout", target);
  git("config", "gites.branch", pick);
  console.log(`Switched to '${target}'.`);
}
