import pc from 'picocolors';
import { gitRun, gitRunAllowFail, gitTry, gitOk, branchExists } from './git.js';
import { resolveLiveBranch, workBranch, baseBranch, setBaseBranch } from './feature.js';
import { originRemote, gitpaceRemote } from './remotes.js';
import { pickBranch } from './pick-branch.js';
import { accent } from './colors.js';
import { withSpinner } from './spinner.js';

export async function changeBase(): Promise<void> {
  const { live } = resolveLiveBranch();
  if (!live) throw new Error('no active feature. Start a new branch or attach first.');
  const work = workBranch(live);
  if (!branchExists(live)) throw new Error(`branch '${live}' not found.`);

  const oldBase = baseBranch(live);
  const origin = originRemote();
  const remote = gitpaceRemote();

  const newBase = await pickBranch({ message: `New base for '${live}':`, exclude: [live] });
  if (newBase === oldBase) {
    console.log(pc.yellow(`Base is already '${newBase}'. Nothing to do.`));
    return;
  }

  console.log(pc.bold(accent(`Re-parent '${live}': ${oldBase} → ${newBase}`)));
  console.log('');

  await withSpinner(`Fetching ${origin}`, () => gitRun('fetch', origin));

  const originRef = (b: string): string | null =>
    gitOk('rev-parse', '--verify', `refs/remotes/${origin}/${b}`) ? `${origin}/${b}` : null;

  const newBaseRef = originRef(newBase) ?? newBase;
  if (!branchExists(newBase) && !originRef(newBase)) {
    throw new Error(`base '${newBase}' not found locally or on ${origin}.`);
  }

  // Upstream to strip: prefer origin/<oldBase>; if the old parent is gone
  // (deleted after merge), fall back to the merge-base with the new base so
  // only <live>'s own commits are replayed.
  let upstream = originRef(oldBase);
  if (!upstream) {
    const mb = gitTry('merge-base', live, newBaseRef);
    if (!mb) throw new Error(`cannot find merge-base of '${live}' and '${newBase}'.`);
    upstream = mb;
    console.log(
      pc.dim(`  (${origin}/${oldBase} gone — replaying ${live}'s own commits onto ${newBase})`),
    );
  }

  // `work` currently sits on the pre-rebase `live` tip; capture it so we replay
  // only work's own commits (oldLive..work) onto the re-parented live below.
  const oldLive = gitTry('rev-parse', live);

  const rebased = await withSpinner(
    `Rebasing ${live} onto ${newBaseRef}`,
    () => gitRunAllowFail('rebase', '--onto', newBaseRef, upstream!, live),
  );
  if (!rebased) {
    console.log('');
    console.log(`Rebase conflict re-parenting '${live}'. Resolve it, then:`);
    console.log('  git rebase --continue   # after fixing conflicts');
    console.log('  git rebase --abort      # to bail out');
    console.log("  # then re-run 'gitpace change-base' if you aborted");
    return;
  }

  setBaseBranch(live, newBase);

  await withSpinner(`Rebasing ${work} onto ${live}`, async () => {
    await gitRun('checkout', work);
    await gitRun('rebase', '--onto', live, oldLive, work);
  });

  console.log('');
  await withSpinner(
    `Pushing ${live} → ${origin} (force-with-lease)`,
    () => gitRun('push', origin, live, '--force-with-lease'),
  );
  await withSpinner(
    `Pushing ${work} → ${remote} (force-with-lease)`,
    () => gitRunAllowFail('push', remote, work, '--force-with-lease'),
  );

  console.log('');
  console.log(pc.bold(pc.green(`Done. '${live}' now targets '${newBase}'.`)));
  console.log(
    pc.yellow(`Note: origin/${live} was rewritten — tell reviewers to re-pull (force).`),
  );
}
