import { git, gitRun, gitRunAllowFail, branchExists } from "./git.js";
import { originRemote, gitesRemote } from "./remotes.js";
import { workBranch, setBaseBranch, isLocalFeatureBase, baseRef } from "./feature.js";
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

  // Stacked on a local feature: work continues from the parent's work branch so
  // the child sees the parent's unshipped commits too.
  const localBase = isLocalFeatureBase(base);
  const workStart = localBase ? workBranch(base) : name;

  if (worktree) {
    if (!localBase) {
      await withSpinner(`Fetching ${origin}/${base}`, () => gitRunAllowFail("fetch", origin, base));
    }
    await withSpinner(`Creating ${name}`, () => gitRun("branch", name, baseRef(base)));
    let path = "";
    await withSpinner(`Creating worktree for ${work}`, async () => {
      path = await addWorktree(name, workStart);
    });
    await withSpinner(`Pushing ${work} → ${remote}`, () =>
      gitRun("-C", path, "push", "-u", remote, work),
    );

    console.log(`Feature started in its own worktree:`);
    console.log(`  ${path}`);
    console.log(`'${name}' stays local until you ship - nothing pushed to ${origin} yet.`);
    return;
  }

  if (localBase) {
    await withSpinner(`Creating ${name}`, () => gitRun("branch", name, base));
    await withSpinner(`Creating ${work}`, () => gitRun("checkout", "-b", work, workStart));
  } else {
    await withSpinner(`Switching to ${base}`, () => gitRun("checkout", base));
    await withSpinner(`Pulling ${origin}/${base}`, () => gitRunAllowFail("pull", origin, base));
    await withSpinner(`Creating ${name}`, () => gitRun("checkout", "-b", name));
    await withSpinner(`Creating ${work}`, () => gitRun("checkout", "-b", work));
  }
  await withSpinner(`Pushing ${work} → ${remote}`, () => gitRun("push", "-u", remote, work));

  console.log(`Feature started. You are on '${work}'.`);
  console.log(`'${name}' stays local until you ship - nothing pushed to ${origin} yet.`);
}
