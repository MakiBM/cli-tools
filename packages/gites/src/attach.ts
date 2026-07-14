import { git, gitRun, gitRunAllowFail, branchExists, currentBranch } from './git.js';
import { originRemote, gitesRemote } from './remotes.js';
import { workBranch, isWorkBranch } from './feature.js';
import { withSpinner } from './spinner.js';

export async function attach(): Promise<void> {
  const current = currentBranch();
  if (!current) throw new Error('detached HEAD. Check out a feature branch first.');
  if (current === 'main') throw new Error("cannot attach from 'main'. Use start-feature instead.");
  if (isWorkBranch(current)) throw new Error('already on a gites-* work branch.');

  const work = workBranch(current);
  if (branchExists(work)) throw new Error(`branch '${work}' already exists.`);

  const origin = originRemote();
  const remote = gitesRemote();

  await withSpinner(`Pulling ${origin}/${current}`, () =>
    gitRunAllowFail('pull', origin, current),
  );

  git('config', 'gites.branch', current);

  await withSpinner(`Creating ${work}`, () => gitRun('checkout', '-b', work));
  await withSpinner(`Pushing ${work} → ${remote}`, () => gitRun('push', '-u', remote, work));

  console.log(`Attached. You are on '${work}'.`);
}
