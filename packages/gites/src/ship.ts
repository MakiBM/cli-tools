import { select, confirm, checkbox, Separator } from "@inquirer/prompts";
import pc from "picocolors";
import { spawnSync, type StdioOptions } from "node:child_process";
import { gitTry, gitRun, gitRunAllowFail, gitOk, branchExists } from "./git.js";
import { resolveLiveBranch, baseBranch } from "./feature.js";
import { workCutPoint, reparentWork } from "./reparent.js";
import { originRemote, gitesRemote } from "./remotes.js";
import { workBranch } from "./feature.js";
import { printArt } from "./banner.js";
import { accent } from "./colors.js";
import { withSpinner } from "./spinner.js";
import {
  distribute,
  validateSchedule,
  canvasLength,
  localDate,
  minutesOf,
  type DayWindow,
} from "./time-distribution.js";
import { editSchedule } from "./schedule-editor.js";

const DAY_START_MIN = 8 * 60; // 08:00 - soft start for days without the first commit
const DAY_END_MIN = 18 * 60; // 18:00 - end of a full working day

function fmt(t: number): string {
  return `${String(Math.floor(t / 60)).padStart(2, "0")}:${String(t % 60).padStart(2, "0")}`;
}

function todayAt(min: number): Date {
  const d = new Date();
  d.setHours(Math.floor(min / 60), min % 60, 0, 0);
  return d;
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00`).getDay();
  return day === 0 || day === 6;
}

function eachDate(startDT: Date, endDT: Date): string[] {
  const out: string[] = [];
  let cursor = new Date(startDT.getFullYear(), startDT.getMonth(), startDT.getDate());
  const last = new Date(endDT.getFullYear(), endDT.getMonth(), endDT.getDate());
  while (cursor.getTime() <= last.getTime()) {
    out.push(localDate(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }
  return out;
}

// Lines changed (insertions + deletions) for a commit - the weight used to size its
// slice of the timeline. Binary/rename lines show as '-' and count as 0.
function commitSize(sha: string): number {
  let total = 0;
  for (const line of gitTry("show", "--numstat", "--format=", sha).split("\n")) {
    const m = /^(\d+)\t(\d+)\t/.exec(line);
    if (m) total += parseInt(m[1]!, 10) + parseInt(m[2]!, 10);
  }
  return total;
}

// The session canvas as day windows (overnight gaps dropped by the distributor):
// - first day starts at the first commit's exact time (kept even if past 18:00),
// - the last day (today) ends at `now`, all other days end at 18:00,
// - days without the first commit start at a jittered ~08:00.
function buildCanvas(startDT: Date, endDT: Date, offDates: ReadonlySet<string>): DayWindow[] {
  const startDate = localDate(startDT);
  const endDate = localDate(endDT);
  const softStart = DAY_START_MIN + Math.floor(Math.random() * 25); // ~08:00, natural
  const windows: DayWindow[] = [];
  for (const date of eachDate(startDT, endDT)) {
    if (offDates.has(date)) continue;
    const isFirst = date === startDate;
    const isLast = date === endDate;
    const startMin = isFirst ? minutesOf(startDT) : softStart;
    let endMin = isLast ? minutesOf(endDT) : DAY_END_MIN;
    if (isFirst && !isLast && startMin > endMin) endMin = startMin; // late first commit stays put
    if (startMin <= endMin) windows.push({ date, startMin, endMin });
  }
  return windows;
}

// Once shipped, gites rebases `work` onto `live`, so `live` is normally an
// ancestor of `work`. If it isn't, `work` was rewritten (rebase/amend/fixup) after
// a ship - its commits would cherry-pick against the wrong base and collide with
// their already-shipped form.
export function workDivergedFromLive(live: string, work: string): boolean {
  return !gitOk("merge-base", "--is-ancestor", live, work);
}

// True when the base upstream (e.g. origin/main) was merged into `work` but is not
// yet on `live`: it's then an ancestor of `work` but not of `live`. Ship excludes
// those commits + the merge commit from its range (so it survives), but that
// silently drops any conflict resolution the merge carried - the base must be
// integrated on the client branch instead. Detect this and stop with instructions.
export function workMergedBaseUpstream(live: string, work: string, baseUpstream: string): boolean {
  return (
    gitOk("rev-parse", "--verify", baseUpstream) &&
    gitOk("merge-base", "--is-ancestor", baseUpstream, work) &&
    !gitOk("merge-base", "--is-ancestor", baseUpstream, live)
  );
}

// Commits to ship: `--cherry-pick --right-only` drops any whose patch-id is already
// on `live` (e.g. re-listed after a reparent), leaving only genuinely new work.
// `baseUpstream` (e.g. origin/main), when given, is excluded too: commits that
// entered `work` via a plain `git merge <base>` are already on the base and would
// cherry-pick as stale diffs against the wrong context. `--no-merges` also drops
// the merge commit itself, which is uncherry-pickable without `-m`.
export function shipCandidateShas(live: string, work: string, baseUpstream?: string): string[] {
  const exclude =
    baseUpstream && gitOk("rev-parse", "--verify", baseUpstream) ? [`^${baseUpstream}`] : [];
  return gitTry(
    "log",
    "--reverse",
    "--format=%H",
    "--no-merges",
    "--cherry-pick",
    "--right-only",
    `${live}...${work}`,
    ...exclude,
  )
    .split("\n")
    .filter(Boolean);
}

export async function ship(): Promise<void> {
  const { live } = resolveLiveBranch();
  if (!live) throw new Error("no active feature. Start a new branch or attach first.");

  const work = workBranch(live);
  if (!branchExists(work)) throw new Error(`branch '${work}' not found. Start a feature first.`);
  if (!branchExists(live)) throw new Error(`branch '${live}' not found. Start a feature first.`);

  // A squash-merged parent leaves its original commits in `work`'s ancestry; they
  // are not reachable from `live` by SHA, so they leak into `live..work` and collide
  // with the squash on cherry-pick. Strip them first so the ship range is clean.
  if (workCutPoint(live, work)) {
    const ok = await withSpinner(
      `Re-parenting ${work} onto ${live} (stripping merged parent)`,
      () => reparentWork(live, work),
    );
    if (!ok) {
      console.log("");
      console.log(`Conflict re-parenting '${work}' onto '${live}'. Resolve it, then:`);
      console.log("  git rebase --continue   # after fixing conflicts");
      console.log("  git rebase --abort      # to bail out");
      console.log("  # then re-run 'gites ship'");
      return;
    }
  }

  // Bail before touching `live` if `work` was rewritten after a ship.
  if (workDivergedFromLive(live, work)) {
    console.log(pc.red(`'${work}' has diverged from '${live}' (history rewritten after a ship).`));
    console.log("Add follow-up commits instead of rewriting shipped ones, then re-run ship.");
    console.log(
      pc.dim(
        `Recover: git checkout ${work} && git reset --hard ${live}, then re-apply the delta as a new commit.`,
      ),
    );
    return;
  }

  const baseUpstream = `${originRemote()}/${baseBranch(live)}`;

  // Merging the base into the work branch is a common instinct, but ship integrates
  // the base on the client branch: the merge's conflict resolution lives only in the
  // merge commit, which the ship range excludes - shipping would drop it silently.
  if (workMergedBaseUpstream(live, work, baseUpstream)) {
    console.log(pc.red(`'${work}' has '${baseUpstream}' merged into it.`));
    console.log(`gites integrates the base on the client branch, not the work branch -`);
    console.log(`shipping would drop the merge's conflict resolution. Do this instead:`);
    console.log("");
    console.log(`  git checkout ${live} && git merge ${baseUpstream}   # resolve here`);
    console.log(`  git checkout ${work} && git rebase ${live}          # reparent work`);
    console.log("  # then re-run 'gites ship'");
    return;
  }

  const allShas = shipCandidateShas(live, work, baseUpstream);

  if (allShas.length === 0) {
    console.log("No new commits to ship.");
    return;
  }

  const allSubjects = allShas.map((sha) => gitTry("log", "-1", "--format=%s", sha));

  // --- commit picker -------------------------------------------------------
  console.clear();
  printArt();
  console.log(pc.bold(accent(`Ship commits to '${live}'`)));
  console.log(pc.dim("Pick the latest commit to ship - everything older is included too."));
  console.log("");

  const upTo = await select<number>({
    message: "Ship up to (and including):",
    pageSize: 20,
    choices: [
      ...allShas.map((sha, i) => ({
        name: `${sha.slice(0, 8)}  ${allSubjects[i]}${i === allShas.length - 1 ? pc.dim("  (newest)") : ""}`,
        value: i,
      })),
      new Separator(),
      { name: pc.dim("Abort"), value: -1 },
    ],
    default: allShas.length - 1,
  });

  if (upTo < 0) {
    console.log("Aborted.");
    return;
  }

  const shas = allShas.slice(0, upTo + 1);
  const subjects = allSubjects.slice(0, upTo + 1);
  const count = shas.length;

  // --- session start/end derivation ---------------------------------------
  // Start = last commit already on `live`; if `live` has nothing beyond its
  // base yet, start at the first commit staged in gites (the oldest one being
  // shipped). A stale last commit yields a multi-day span.
  const base = baseBranch(live);
  const liveHasNew = gitTry("rev-list", "--count", `${base}..${live}`) !== "0";
  const startISO = liveHasNew
    ? gitTry("log", "-1", "--format=%cI", live)
    : gitTry("log", "-1", "--format=%aI", allShas[0]!);
  const startDT = startISO ? new Date(startISO) : todayAt(DAY_START_MIN);
  const endDT = new Date();

  const sizes = shas.map(commitSize);
  const candidateDates = eachDate(startDT, endDT);

  // --- session window screen ----------------------------------------------
  {
    console.clear();
    printArt();
    console.log(pc.bold(accent("Session window")));
    console.log(
      pc.dim(`Working hours up to ${fmt(DAY_END_MIN)}; commits spread by size across the window.`),
    );
    console.log("");
    console.log(`  Start:   ${pc.cyan(`${localDate(startDT)} ${fmt(minutesOf(startDT))}`)}`);
    console.log(
      `  End:     ${pc.cyan(`${localDate(endDT)} ${fmt(minutesOf(endDT))}`)}  ${pc.dim("(now)")}`,
    );
    console.log(`  Commits: ${count}`);
    console.log("");

    const action = await select<"go" | "abort">({
      message: "Use this session?",
      choices: [
        { name: "Continue", value: "go" },
        { name: "Abort", value: "abort" },
      ],
    });
    if (action === "abort") {
      console.log("Aborted.");
      return;
    }
  }

  // --- day-off screen (multi-day only) ------------------------------------
  let offDates = new Set<string>();
  if (candidateDates.length > 1) {
    const kept = await checkbox<string>({
      message: "Ship on which days? (space toggles; weekends off by default)",
      choices: candidateDates.map((d) => ({
        name: `${new Date(`${d}T00:00:00`).toLocaleDateString("en-US", { weekday: "short" })} ${d}`,
        value: d,
        checked: !isWeekend(d),
      })),
      pageSize: 20,
    });
    offDates = new Set(candidateDates.filter((d) => !kept.includes(d)));
  }

  if (candidateDates.length > 1 && offDates.size === candidateDates.length) {
    console.log(pc.red("All days are off - nothing to ship."));
    return;
  }

  let days = buildCanvas(startDT, endDT, offDates);
  if (days.length === 0) {
    days = [{ date: localDate(endDT), startMin: minutesOf(endDT), endMin: minutesOf(endDT) }];
  }
  // Guarantee enough room for distinct minute stamps; if the canvas is tighter than
  // the commit count, nudge the first day's start back (never past midnight).
  const deficit = count - 1 - canvasLength(days);
  if (deficit > 0) {
    days[0] = { ...days[0]!, startMin: Math.max(0, days[0]!.startMin - deficit) };
  }

  const initial = distribute(sizes, days);

  // --- time editing TUI ----------------------------------------------------
  console.clear();
  printArt();
  const result = await editSchedule({
    title: `Ship ${count} commit(s) to '${live}'`,
    subtitle: `Session: ${localDate(startDT)} ${fmt(minutesOf(startDT))} - ${localDate(endDT)} ${fmt(minutesOf(endDT))}`,
    rows: shas.map((sha, i) => ({ sha, subject: subjects[i]! })),
    schedule: initial,
    days,
    regenerate: () => distribute(sizes, days),
    validate: validateSchedule,
  });

  if (result.action === "abort") {
    console.log("Aborted.");
    return;
  }
  const schedule = result.schedule;

  // --- confirm + cherry-pick ----------------------------------------------
  console.clear();
  printArt();
  console.log(pc.bold(accent("Ready to ship:")));
  for (let i = 0; i < count; i++) {
    console.log(
      `  ${schedule[i]!.date.slice(5)} ${schedule[i]!.time}  ${shas[i]!.slice(0, 8)}  ${subjects[i]}`,
    );
  }
  console.log("");
  const ok = await confirm({
    message: `Cherry-pick to '${live}' and push to origin?`,
    default: true,
  });
  if (!ok) {
    console.log("Aborted.");
    return;
  }

  await gitRun("checkout", live);
  // Snapshot live's tip so a mid-loop failure rolls back cleanly. A
  // `cherry-pick --no-commit` conflict leaves no sequencer state, so
  // `cherry-pick --abort` is a no-op ("no cherry-pick in progress") that neither
  // clears the index nor undoes commits already made this ship. Hard-resetting to
  // this snapshot is what makes "'live' is unchanged" actually true.
  const preShip = gitTry("rev-parse", "HEAD");

  let failed = false;
  for (let i = 0; i < count; i++) {
    const sha = shas[i]!;
    // Natural seconds (never :00) so stamps don't look machine-generated.
    const sec = String(1 + Math.floor(Math.random() * 59)).padStart(2, "0");
    const stamp = `${schedule[i]!.date}T${schedule[i]!.time}:${sec}`;
    const cpOk = await withSpinner(`Cherry-picking ${sha.slice(0, 8)} as ${stamp}`, () =>
      gitRunAllowFail("cherry-pick", "--no-commit", sha),
    );
    if (!cpOk) {
      console.log("");
      console.log(
        `Cherry-pick conflict on ${sha.slice(0, 8)} - reverted this ship, '${live}' is unchanged.`,
      );
      console.log(
        `  '${work}' likely conflicts with what was already shipped; rebase it onto '${live}' and retry.`,
      );
      failed = true;
      break;
    }
    const env = { ...process.env, GIT_AUTHOR_DATE: stamp, GIT_COMMITTER_DATE: stamp };
    const stdio: StdioOptions = process.env.GITES_VERBOSE ? "inherit" : ["inherit", "pipe", "pipe"];
    const r = spawnSync("git", ["commit", "-m", subjects[i]!], { stdio, env });
    if (r.status !== 0) {
      failed = true;
      break;
    }
  }

  if (!failed) {
    const origin = originRemote();
    const remote = gitesRemote();
    console.log("");
    // Fetch with --prune so the remote-tracking ref reflects reality: a plain fetch
    // leaves a stale ref when origin/<live> was deleted (merged PR, cleanup), and
    // --force-with-lease would then abort with "stale info".
    await withSpinner(`Fetching ${origin}`, () => gitRunAllowFail("fetch", "--prune", origin));
    // If origin/<live> exists its history may diverge (re-parenting rewrites live),
    // so force-with-lease. If it's absent this is a fresh create - a plain push, since
    // force-with-lease has no ref to lease against and would fail.
    const remoteHasLive = gitOk("rev-parse", "--verify", `refs/remotes/${origin}/${live}`);
    const pushArgs = remoteHasLive
      ? ["push", "-u", origin, live, "--force-with-lease"]
      : ["push", "-u", origin, live];
    await withSpinner(`Pushing ${live} → ${origin}`, () => gitRun(...pushArgs));
    await withSpinner(`Rebasing ${work} onto ${live}`, async () => {
      await reparentWork(live, work);
      await gitRunAllowFail("push", remote, work, "--force-with-lease");
    });

    console.log(pc.bold(pc.green(`Done. Shipped ${count} commit(s).`)));
  } else {
    // Roll back any commits made this ship and clear the half-applied index, so
    // `live` really is unchanged and the checkout back to `work` isn't blocked by
    // an unmerged index.
    await gitRunAllowFail("reset", "--hard", preShip);
    await gitRunAllowFail("checkout", work);
  }
}
