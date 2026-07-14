import { git, gitRun, gitRunAllowFail, branchExists } from "./git.js";
import { originRemote, gitesRemote } from "./remotes.js";
import { workBranch, setBaseBranch } from "./feature.js";
import { addWorktree, worktreeEnabled } from "./worktree.js";
import { withSpinner } from "./spinner.js";

export async function startFeature(
  name: string | undefined,
  base: string = "main",
  worktree: boolean = worktreeEnabled(),
): Promise<void> {
  if (!name) throw new Error("Usage: gites start-feature <name> [base]");

  const work = workBranch(name);
  const origin = originRemote();
  const remote = gitesRemote();

  if (branchExists(name)) {
    throw new Error(`Branch '${name}' already exists. Delete it first or pick a different name.`);
  }

  git("config", "gites.branch", name);
  setBaseBranch(name, base);

  if (worktree) {
    await withSpinner(`Fetching ${origin}/${base}`, () => gitRunAllowFail("fetch", origin, base));
    await withSpinner(`Creating ${name}`, () => gitRun("branch", name, `${origin}/${base}`));
    let path = "";
    await withSpinner(`Creating worktree for ${work}`, async () => {
      path = await addWorktree(name, name);
    });
    await withSpinner(`Pushing ${work} → ${remote}`, () =>
      gitRun("-C", path, "push", "-u", remote, work),
    );

    console.log(`Feature started in its own worktree:`);
    console.log(`  ${path}`);
    console.log(`'${name}' stays local until you ship - nothing pushed to ${origin} yet.`);
    return;
  }

  await withSpinner(`Switching to ${base}`, () => gitRun("checkout", base));
  await withSpinner(`Pulling ${origin}/${base}`, () => gitRunAllowFail("pull", origin, base));

  await withSpinner(`Creating ${name}`, () => gitRun("checkout", "-b", name));
  await withSpinner(`Creating ${work}`, () => gitRun("checkout", "-b", work));
  await withSpinner(`Pushing ${work} → ${remote}`, () => gitRun("push", "-u", remote, work));

  console.log(`Feature started. You are on '${work}'.`);
  console.log(`'${name}' stays local until you ship - nothing pushed to ${origin} yet.`);
}
