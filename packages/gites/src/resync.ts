import pc from "picocolors";
import { gitRun, gitRunAllowFail, gitOk, branchExists } from "./git.js";
import { resolveLiveBranch, workBranch, baseBranch, isLocalFeatureBase } from "./feature.js";
import { reparentWork } from "./reparent.js";
import { branchCheckedOutElsewhere } from "./worktree.js";
import { originRemote, gitesRemote } from "./remotes.js";
import { accent } from "./colors.js";
import { withSpinner } from "./spinner.js";
import { refreshLock, LOCK_MESSAGE } from "./lock.js";

const tick = pc.green("✔");
const arrow = pc.dim("→");

export async function resync(): Promise<void> {
  const { live } = resolveLiveBranch();
  const work = live ? workBranch(live) : "";
  const origin = originRemote();
  const remote = gitesRemote();

  const title = live ? `Resync ${live} with ${origin}/${live}` : `Resync with ${origin}`;
  console.log(pc.bold(accent(title)));
  console.log("");
  const locked = live ? refreshLock(live) : false;
  if (locked) console.log(pc.yellow(`  ${LOCK_MESSAGE(live)}`));

  await withSpinner(
    `Fetching ${origin}`,
    () => gitRun("fetch", origin),
    `${tick} Fetched ${origin}`,
  );

  const mainElsewhere = branchCheckedOutElsewhere("main");

  if (mainElsewhere) {
    console.log(
      pc.dim("  (main is checked out in another worktree - leaving it to that checkout)"),
    );
  } else {
    await withSpinner(
      "Updating main",
      async () => {
        await gitRun("checkout", "main");
        await gitRun("merge", "--ff-only", `${origin}/main`);
      },
      `${tick} Updated main ${pc.dim("(fast-forward)")}`,
    );
  }

  await withSpinner(
    `Mirroring main → ${remote}`,
    async () => {
      const ref = mainElsewhere ? `${origin}/main:main` : "main";
      const ok = await gitRunAllowFail("push", remote, ref);
      if (!ok) throw new Error("skip");
    },
    `${tick} Mirrored main ${arrow} ${remote}`,
  ).catch(() => {
    console.log(pc.yellow(`! Skipped mirror to ${remote}`));
  });

  if (live) {
    const base = baseBranch(live);
    const baseRef = isLocalFeatureBase(base) ? base : `${origin}/${base}`;
    const baseExists = base !== "main" && gitOk("rev-parse", "--verify", baseRef);
    if (branchExists(live) && baseExists) {
      await withSpinner(
        `Rebasing ${live} onto ${baseRef}`,
        async () => {
          await gitRun("checkout", live);
          await gitRun("rebase", baseRef);
        },
        `${tick} Rebased ${live} onto ${baseRef} ${pc.dim("(base)")}`,
      );
    }

    const originLiveExists = gitOk("rev-parse", "--verify", `refs/remotes/${origin}/${live}`);

    if (branchExists(live) && originLiveExists) {
      await withSpinner(
        `Rebasing ${live} onto ${origin}/${live}`,
        async () => {
          await gitRun("checkout", live);
          await gitRun("rebase", `${origin}/${live}`);
        },
        `${tick} Rebased ${live} onto ${origin}/${live}`,
      );
    } else if (branchExists(live) && !originLiveExists) {
      console.log(pc.dim(`  (${origin}/${live} not on remote yet - skipping live rebase)`));
    }

    if (branchExists(work) && !locked) {
      await withSpinner(
        `Rebasing ${work} onto ${live}`,
        async () => {
          await reparentWork(live, work);
          await gitRunAllowFail("push", remote, work, "--force-with-lease");
        },
        `${tick} Rebased ${work} onto ${live} ${arrow} ${remote}`,
      );
    }
  }

  if (work && branchExists(work)) {
    await gitRunAllowFail("checkout", locked ? live : work);
  }
  console.log("");
  console.log(pc.bold(pc.green("✔ Resync complete")));
}
