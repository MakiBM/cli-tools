---
"@makibm/gites": minor
---

Configurable work-branch prefix, cleanup command, config menu, and legacy gitpace migration.

- Work-branch prefix is configurable per repo via `gites.workprefix` (default `gites-`); the setup wizard and pre-push hook read it at runtime.
- New `gites cleanup`: prunes finished features (PR closed + branch gone from origin, detected via `gh`), removing the local live branch, local + backup work branch, and worktree. Confirms first, lets you opt out of branches to keep, and prints a copy-paste command for anything with uncommitted changes. Never touches origin.
- New `gites config` menu: change prefix (with optional rename of existing work branches, local + backup only), worktree default, and backup remote without re-running setup.
- Legacy `gitpace` repos are auto-detected on startup and can be migrated into the `gites.*` namespace (keeps the `gitpace-` prefix and remote).
- Safety: refuse any destructive backup-remote push when the backup remote is (or points at) origin.
- Drop "client" from the tagline/description.
