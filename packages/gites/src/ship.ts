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
  genSchedule,
  validateSchedule,
  buildDayWindows,
  dayCapacity,
  localDate,
  minutesOf,
  type DayWindow,
} from "./time-distribution.js";
import { editSchedule } from "./schedule-editor.js";

const MIN_GAP_MIN = 20;
const WORK_START_MIN = 10 * 60; // 10:00
const WORK_END_MIN = 16 * 60 + 30; // 16:30

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

// Once shipped, gites rebases `work` onto `live`, so `live` is normally an
// ancestor of `work`. If it isn't, `work` was rewritten (rebase/amend/fixup) after
// a ship - its commits would cherry-pick against the wrong base and collide with
// their already-shipped form.
export function workDivergedFromLive(live: string, work: string): boolean {
  return !gitOk("merge-base", "--is-ancestor", live, work);
}

// Commits to ship: `--cherry-pick --right-only` drops any whose patch-id is already
// on `live` (e.g. re-listed after a reparent), leaving only genuinely new work.
export function shipCandidateShas(live: string, work: string): string[] {
  return gitTry(
    "log",
    "--reverse",
    "--format=%H",
    "--cherry-pick",
    "--right-only",
    `${live}...${work}`,
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

  const allShas = shipCandidateShas(live, work);

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
  const startDT = startISO ? new Date(startISO) : todayAt(WORK_START_MIN);
  const endDT = new Date();

  const candidateDates = eachDate(startDT, endDT);

  // --- session window screen ----------------------------------------------
  {
    console.clear();
    printArt();
    console.log(pc.bold(accent("Session window")));
    console.log(
      pc.dim(
        `Working hours ${fmt(WORK_START_MIN)}–${fmt(WORK_END_MIN)}, times ≥${MIN_GAP_MIN}m apart.`,
      ),
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

  let days: DayWindow[] = buildDayWindows(startDT, endDT, offDates, WORK_START_MIN, WORK_END_MIN);
  if (days.length === 0) {
    if (candidateDates.length > 1 && offDates.size === candidateDates.length) {
      console.log(pc.red("All days are off - nothing to ship."));
      return;
    }
    days = [{ date: localDate(new Date()), startMin: WORK_START_MIN, endMin: WORK_START_MIN }];
  }

  const capacity = days.reduce((sum, d) => sum + dayCapacity(d, MIN_GAP_MIN), 0);
  const overflowMsg =
    count > capacity
      ? `Warning: ${count} commits exceed the ${capacity}-slot capacity of the selected days. Spilling ${count - capacity} past ${fmt(days[days.length - 1]!.endMin)} on the last day.`
      : "";

  const initial = genSchedule(count, days, MIN_GAP_MIN);

  // --- time editing TUI ----------------------------------------------------
  console.clear();
  printArt();
  const result = await editSchedule({
    title: `Ship ${count} commit(s) to '${live}'`,
    subtitle: `Session: ${localDate(startDT)} ${fmt(minutesOf(startDT))} - ${localDate(endDT)} ${fmt(minutesOf(endDT))}`,
    overflow: overflowMsg || undefined,
    rows: shas.map((sha, i) => ({ sha, subject: subjects[i]! })),
    schedule: initial,
    regenerate: () => genSchedule(count, days, MIN_GAP_MIN),
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

  let failed = false;
  for (let i = 0; i < count; i++) {
    const sha = shas[i]!;
    const stamp = `${schedule[i]!.date}T${schedule[i]!.time}:00`;
    const cpOk = await withSpinner(`Cherry-picking ${sha.slice(0, 8)} as ${stamp}`, () =>
      gitRunAllowFail("cherry-pick", "--no-commit", sha),
    );
    if (!cpOk) {
      // Self-heal: abort the half-applied pick so the index is clean and the
      // checkout back to `work` below can succeed (an unmerged index blocks it).
      await gitRunAllowFail("cherry-pick", "--abort");
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
    await gitRunAllowFail("checkout", work);
  }
}
