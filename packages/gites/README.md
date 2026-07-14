# gitpace

Two-track git workflow for batching and timing client commits.

Batch your work session on a private branch backed up to your own remote.
Ship commits to the client branch with hand-picked timestamps, one chunk at
a time.

## Install

```
npm install -g gitpace          # or: npx gitpace
```

Then in any repo:

```
gitpace
```

The TUI walks you through first-time setup (detects your origin, prompts for
the URL of your private "gitpace" remote, installs a `pre-push` safety hook).

### Prerequisites

- **Node 20+**
- **git**

## Usage

```
gitpace                          # Open the TUI (default)
gitpace start-feature <name> [base]  # Create <name> + gitpace-<name> from origin/<base> (default main)
gitpace start-feature <name> --worktree  # ...in its own worktree under <repo>.worktrees/<name>
gitpace attach                   # Adopt the current origin branch as a gitpace feature
gitpace switch                   # Switch between features (prints the path for worktree ones)
gitpace change-base              # Re-parent the active feature onto a new base (PR chains)
gitpace ship                     # Cherry-pick commits with custom timestamps
gitpace resync                   # Pull origin and rebase working branches
gitpace setup                    # Re-run first-time setup
gitpace help                     # Show help
```

Flags: `-v` / `--verbose` to surface raw git output.

## Worktrees

Pass `--worktree` to `start-feature` (or answer "Own worktree?" in the TUI) to
create the feature in its own git worktree at `<repo>.worktrees/<name>` instead
of checking it out in place. Each feature then has its own folder, so you can
have several checked out at once. `switch` prints the folder to `cd` into rather
than moving your current checkout. Run `git config gitpace.worktree true` (or the
setup wizard toggle) to make worktrees the default for new features.

## The workflow

- **`gitpace-<name>`** — your working branch. Pushed only to your private
  `gitpace` remote. Never reaches the client.
- **`<name>`** — the client-facing branch. Created locally at
  `start-feature` and **not pushed to origin until your first `ship`**, so
  branching a chain off a not-yet-published base leaks nothing. Commits arrive
  one ship at a time via the TUI, each with a custom timestamp.

You batch many small commits on `gitpace-<name>` during one session; later
you run `gitpace ship` and pick the commit cutoff. The session starts at the
last commit already on `<name>` (or today `10:00` on a first ship) and runs to
now, and commits are distributed within working hours `10:00–16:30`. If the
span covers several days you can mark days off (weekends are pre-disabled), and
the chunk lands on `<name>` with timestamps.

## PR chains (stacked branches)

You can branch a feature off another feature instead of `main` — pick the base
in the "New feature" wizard (fuzzy type-to-filter over local + `origin/*`
branches), or `gitpace start-feature <name> <base>`. The base is stored per
feature and becomes the branch your PR should target.

Example:

- `214` — epic, base `main`
- `237` — base `214`; PR targets `214`
- `238` — base `237` (keep working while `237` is in review); PR targets `237`

When `237` is merged into `214`, re-parent `238` with **Change base** (or
`gitpace change-base`) and pick `214`. Its PR now targets `214`.

### Avoiding conflicts

- **A child's PR target = its base.** Set the base to the branch that will
  contain the parent's work after merge.
- **Prefer merge/rebase-merge over squash for a parent that has children.**
  A merge or rebase-merge preserves the parent's commits as the same SHAs, so
  the child's rebase treats them as already applied — a true no-op, trivially
  clean. Squash rewrites history, which is what forces the `--onto` dance below.
  Reserve squash for leaf/standalone PRs.
- **After a squash-merge, use `change-base` — not a plain rebase.** A plain
  `git rebase origin/<grandparent>` (or `git merge`) re-applies every one of the
  parent's individual commits (still present in the child) on top of a base that
  already contains them squashed — every commit conflicts. `change-base` runs
  `git rebase --onto origin/<newBase> origin/<oldBase> <child>`, replaying **only
  the child's own commits**, so the parent's commits are never re-applied. This
  eliminates the duplicate-commit avalanche. It does **not** eliminate genuine
  conflicts: if your own commits touch the same lines the squash changed (or the
  squash author applied review edits), you still resolve those — but they're the
  normal, minimal kind.
- **Rebase only your own un-reviewed work.** Re-parenting a live branch that is
  already under review force-pushes it (`--force-with-lease`); tell reviewers to
  re-pull.
- **Keep chains short.** Land parents before stacking deeper.

## Demo mode

To play with the TUI on fake data without touching any real repo:

```
npm run demo            # pick a scenario, then drop into the TUI
npm run demo -- active  # jump straight to a seeded scenario
npm run demo:reset      # wipe the demo sandbox
```

Scenarios: `fresh` (run setup wizard), `ready`, `active` (commits ready to
ship), `multi` (multiple features for `switch`), `teammate` (origin moved
ahead for `resync`), `attachable` (existing origin branch for `attach`).

The sandbox lives at `$TMPDIR/gitpace-demo/` — entirely outside your repo.

## What gitpace writes to your clone (local only)

- Adds a `gitpace` remote (your private repo for the `gitpace-*` work branches)
- Installs a `pre-push` hook in `.git/hooks/pre-push` (or your `core.hooksPath`
  if set) — blocks `gitpace-*` branches from ever reaching origin. An existing
  `pre-push` hook is backed up to `pre-push.pre-gitpace`.
- Sets a few configs in `gitpace.*` namespace (`origin`, `remote`, `branch`)

That's it. `core.hooksPath`, `remote.pushDefault`, and aliases are **never**
touched — you can use the repo normally outside gitpace. Branches created by
gitpace have proper per-branch upstreams (`<feature>` → origin,
`gitpace-<feature>` → gitpace), so `git push` from any branch goes where you'd
expect.

None of this touches origin or anyone else who pulls from it.

## Gotchas

- **The hook is per-clone.** Re-run setup after cloning on a new machine (the
  TUI detects this automatically).
- **Don't rebase the origin branch after the client has reviewed it.** Use
  `git merge main` instead.
- **The `pre-push` hook is your safety net** — blocks `gitpace-*` branches
  from reaching `origin`.
- **Cherry-pick conflicts** are caught and the script stops with recovery
  instructions instead of silently failing.

## License

MIT
