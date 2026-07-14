import { select } from "@inquirer/prompts";
import { git, gitRun } from "./git.js";
import { listFeatures, workBranch } from "./feature.js";
import { worktreeForFeature } from "./worktree.js";

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

  const path = worktreeForFeature(pick);
  if (path) {
    console.log(`'${pick}' lives in its own worktree. cd into it:`);
    console.log(`  ${path}`);
    return;
  }

  await gitRun("checkout", workBranch(pick));
  git("config", "gites.branch", pick);
  console.log(`Switched to '${workBranch(pick)}'.`);
}
