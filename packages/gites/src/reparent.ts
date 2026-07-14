import { gitTry, gitRun, gitRunAllowFail } from "./git.js";

// A squash-merged parent (common in PR chains: main → A → B, where A lands on
// main/live as one squashed commit) leaves the parent's ORIGINAL commits in the
// child work branch's ancestry under different SHAs than the squash. `live..work`
// is computed by SHA reachability, so those originals leak in and re-applying them
// collides with the squash already on live. Per-commit patch-id dedup can't help:
// a squash's patch-id never equals any single original commit's.
//
// Detect the boundary by CONTENT instead: the squash commit on live has the same
// tree as the parent segment's tip on work. The newest work commit whose full tree
// snapshot already exists on live is that boundary - everything up to it is already
// merged, so we strip it wholesale with `git rebase --onto live <boundary> work`.
export function workCutPoint(live: string, work: string): string | null {
  const mergeBase = gitTry("merge-base", live, work);
  if (!mergeBase) return null;

  const liveTrees = new Set(
    gitTry("rev-list", `${mergeBase}..${live}`)
      .split("\n")
      .filter(Boolean)
      .map((sha) => gitTry("rev-parse", `${sha}^{tree}`))
      .filter(Boolean),
  );
  if (liveTrees.size === 0) return null;

  const workShas = gitTry("rev-list", `${live}..${work}`).split("\n").filter(Boolean); // newest first
  for (const sha of workShas) {
    const tree = gitTry("rev-parse", `${sha}^{tree}`);
    if (tree && liveTrees.has(tree)) return sha;
  }
  return null;
}

// Rebase `work` onto `live`, stripping a squash-merged parent segment when detected.
// Falls back to a plain rebase when there is nothing already-merged to strip.
// Assumes the caller has fetched/updated `live`. Returns false on conflict.
export async function reparentWork(live: string, work: string): Promise<boolean> {
  const cut = workCutPoint(live, work);
  await gitRun("checkout", work);
  if (cut) {
    return gitRunAllowFail("rebase", "--onto", live, cut, work);
  }
  return gitRunAllowFail("rebase", live);
}
