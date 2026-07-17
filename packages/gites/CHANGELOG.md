# @makibm/gites

## 1.3.0

### Minor Changes

- 4e9afa8: Rework ship time distribution around a working-hours "canvas" and commit size:

  - Commits are spread across the session as a canvas of per-day windows with the
    overnight gaps removed. The first day anchors to the first commit's real time,
    the newest commit lands at `now` (never in the future), other days run to 18:00
    and non-first days start at a jittered ~08:00.
  - Placement is size-weighted: the gap before each commit is 80% proportional to its
    lines changed and 20% random, so larger commits get more time before them.
  - Times get natural seconds instead of `:00`.
  - Editor arrows are canvas-aware: left/right shifts a commit by 15 minutes, rolling
    across day boundaries and clamping to the canvas; the per-commit editor's date
    field hops to the adjacent working day.

  Fixes the previous behavior that crammed commits into a tiny window and stamped some
  in the future.

## 1.2.0

### Minor Changes

- 928ed17: Ship time editing overhaul: the schedule screen now adjusts a commit's time with
  left/right arrows in 15-minute steps, and Enter opens a per-commit editor with
  separate prefilled Date and Time fields (left/right shift time ±15m or date ±1d,
  Tab switches field). When `live` has no prior commits the session window now
  starts at the first commit staged in gites instead of a hardcoded 10:00. Worktree
  setup also copies `.env*` files nested in workspaces (e.g. `apps/shell/.env.local`),
  not just top-level ones.

## 1.1.2

### Patch Changes

- 75fba14: Fix first-time setup wrongly triggering inside a linked worktree: hook detection
  used `--git-dir` (the per-worktree dir) instead of the shared common dir where
  git actually runs hooks, so `gites` treated an already-set-up repo as new.

## 1.1.1

### Patch Changes

- 402c81b: Fix crash on `installHook` in the published package: the bundled `hooks/pre-push`
  was resolved for the source layout only, so setup/migration threw `ENOENT` from
  the built `dist/src/` layout. Resolve the hook against both layouts.

## 1.1.0

### Minor Changes

- 42c1a7e: Configurable work-branch prefix, cleanup command, config menu, and legacy gitpace migration.

  - Work-branch prefix is configurable per repo via `gites.workprefix` (default `gites-`); the setup wizard and pre-push hook read it at runtime.
  - New `gites cleanup`: prunes finished features (PR closed + branch gone from origin, detected via `gh`), removing the local live branch, local + backup work branch, and worktree. Confirms first, lets you opt out of branches to keep, and prints a copy-paste command for anything with uncommitted changes. Never touches origin.
  - New `gites config` menu: change prefix (with optional rename of existing work branches, local + backup only), worktree default, and backup remote without re-running setup.
  - Legacy `gitpace` repos are auto-detected on startup and can be migrated into the `gites.*` namespace (keeps the `gitpace-` prefix and remote).
  - Safety: refuse any destructive backup-remote push when the backup remote is (or points at) origin.
  - Drop "client" from the tagline/description.
