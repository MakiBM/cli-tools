// Rules gites enforces, in the words it prints. The agent skill is generated
// from the same list so instructions and enforcement never drift.
export interface Rule {
  title: string;
  body: string;
}

export const RULES: Rule[] = [
  {
    title: "Never merge the base into the work branch",
    body: "To pick up main (or a parent feature), run `git rebase` on `gites-<name>`, never `git merge`. A merge injects the base's own commits and a merge commit into the ship range; `gites ship` hard-stops when it detects one.",
  },
  {
    title: "Resolve conflicts with the base on the live branch",
    body: "`git checkout <name> && git merge origin/<base>`, resolve, commit. The live branch is the PR source, so this is where the client sees the resolution. Never resolve on `gites-<name>`.",
  },
  {
    title: "After a squash-merged parent, run `gites change-base`",
    body: "It replays only the child's own commits (`git rebase --onto`), so the parent's individual commits never re-apply. A plain rebase or merge conflicts on every parent commit.",
  },
  {
    title: "Stacked features ship parent first",
    body: "`gites start-feature <child> <parent>` may use a local, unshipped parent. `gites ship` on the child refuses until the parent has no unshipped commits: `ship '<parent>' first`.",
  },
  {
    title: "Timestamps never go backwards",
    body: "Every ship starts after the newest shipped commit on any feature (the timeline floor), and never lands in the future. The session editor clamps to it.",
  },
  {
    title: "A PR locks the work branch",
    body: "Once `<name>` has an open or merged PR, `gites-<name>` is locked: the pre-commit hook refuses commits, `gites ship` refuses, `gites switch` checks out `<name>`. Review fixes and main merges land on `<name>` directly. `gites unlock <name>` reopens it after rebasing work onto live.",
  },
  {
    title: "Agents ship with `gites ship --yes`",
    body: "Non-interactive: every pending commit, window from the floor to now, weekends off, then push to origin. Run it only after the user approved the ship. The interactive `gites ship` stays for hand-tuned timing.",
  },
  {
    title: "QA fix branches are plain git",
    body: "After a ticket reaches QA, fixes go on `<ticket>-qa-fixes` from `origin/main`, outside gites. Do not `gites attach` them.",
  },
];
