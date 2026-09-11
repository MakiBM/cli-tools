# Agent Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement spec `docs/superpowers/specs/2026-09-11-agent-workflow-design.md`: gites local stacks + timeline + lock + `ship --yes` + agent skill; `ws` workspace tool; bell; write guard; `/ticket` skill and manager role.

**Architecture:** Five independent deliverables. A and B are cli-tools packages (TS, ESM, cli-kit). C and D live in `~/.claude`. E lives in npo-cms-frontend `.claude` (its own git repo).

**Tech Stack:** Node 20, TypeScript NodeNext, vitest, pnpm workspace, AeroSpace, SwiftBar, Raycast Script Commands, bash hooks.

## Global Constraints

- English only, ASCII `-`, no emoji, no em dash.
- Relative imports end in `.js`, builtins `node:`.
- cli-kit for visuals. Tests through pure seams, git sandboxes via `tests/helpers.ts`.
- Commit per task, Conventional Commits, no ticket ids. Run `pnpm format` before commit in cli-tools.
- Changeset per package with shippable change.
- Never push. Never touch origin branches of npo. `.claude` repo commits go in that nested repo.

---

## A. gites (`packages/gites`)

### Task A1: base resolution local-or-origin

**Files:** Modify `src/feature.ts`, `src/start-feature.ts`, `src/rebase-base.ts`, `src/resync.ts`. Test `tests/stack.test.ts` (new).

**Interfaces:** Produces `baseRef(base: string): string` in `feature.ts`: returns local `<base>` when it is a gites feature live branch (`branchExists(base) && branchExists(workBranch(base))`), else `${originRemote()}/${base}`. Produces `isLocalFeatureBase(base)`.

- [ ] Test: sandbox, `start-feature a` (worktree false), commit on `gites-a`, then `startFeature("b", "a")`. Assert `b` tip == `a` tip, `gites-b` tip == `gites-a` tip, `origin` has no `b`, `baseBranch("b") === "a"`.
- [ ] Implement `baseRef`, use in `startFeature` (branch `name` from `baseRef(base)`, work from `workBranch(base)` when local feature base else from `name`), `changeBase` (`newBaseRef = baseRef(newBase)`), `resync` (skip origin check when local base).
- [ ] Run `pnpm --filter @makibm/gites test`, commit `feat(gites): local gites feature as base`.

### Task A2: parent-first ship + child candidates

**Files:** Modify `src/ship.ts`. Test `tests/stack.test.ts`.

**Interfaces:** Produces `parentPending(base: string): number` (count `base..gitesWork(base)`), and `shipCandidateShas(live, work, excludes: string[])` (replace `baseUpstream?` param with a list; `^${x}` for each existing ref).

- [ ] Test: chain a->b, unshipped a: `parentPending("a") > 0`. `shipCandidateShas("b","gites-b",["gites-a"])` lists only b's commits.
- [ ] Implement: in `ship()`, if `isLocalFeatureBase(base)`: if `parentPending(base)>0` print `ship '<base>' first: it has N unshipped commit(s)` and return. Rebase live child onto live parent: `git rebase <base> <live>` (both local) before candidates. Excludes = `[baseRef(base), workBranch(base) if local]`.
- [ ] Commit `feat(gites): parent-first ship for local stacks`.

### Task A3: global timeline floor

**Files:** Create `src/timeline.ts`. Modify `src/ship.ts`, `src/session-editor.ts`. Test `tests/timeline.test.ts`.

**Interfaces:** `timelineFloor(): Date | null` = max committer date over `for-each-ref refs/heads refs/remotes/<origin>` excluding work-prefixed refs and `main`, where the ref is a gites live branch (`listFeatures()` names, plus their origin refs). `SessionEditorConfig.floor?: Stamp`: `timeBounds` lo = max(lo, floor time when same date), `shiftDate` cannot go before floor date.

- [ ] Test: sandbox, feature a shipped with `GIT_COMMITTER_DATE=2026-09-01T12:00:00`, feature b unshipped: `timelineFloor()` == 2026-09-01T12:00 local.
- [ ] Implement `timeline.ts`; in `ship()`: `startDT = max(startISO-derived, floor)`; pass `floor` to `editSessionWindow`; clamp `editableCanvas` first day start to floor when same date.
- [ ] Commit `feat(gites): global timeline floor across features`.

### Task A4: `ship --yes`

**Files:** Modify `src/cli.ts`, `src/ship.ts`. Test `tests/ship-yes.test.ts`.

**Interfaces:** `ship(opts: { yes?: boolean })`. Non-interactive: all candidates, start=floor/derived, end=now, weekends off, `distribute`, print plan table, cherry-pick, push, reparent. No prompts.

- [ ] Test: sandbox with origin, feature a, 2 commits on `gites-a`, `await ship({yes:true})`: origin has `a` with 2 commits, timestamps ascending and <= now.
- [ ] Implement: extract `applyShip(live, work, shas, subjects, schedule)` from the loop; `--yes` path builds schedule without editors.
- [ ] Commit `feat(gites): non-interactive ship --yes`.

### Task A5: PR lock

**Files:** Create `src/lock.ts`, `hooks/pre-commit`. Modify `src/ship.ts`, `src/switch.ts`, `src/resync.ts`, `src/hook-install.ts`, `src/cli.ts`, `src/tui.ts`. Test `tests/lock.test.ts`.

**Interfaces:** `isLocked(name): boolean` reads `branch.<name>.giteslocked`. `refreshLock(name): boolean` runs `gh pr view <name> --json state -q .state` (OPEN|MERGED -> lock), sets config, returns state. `LOCK_MESSAGE(name) = "PR open for <name>, commit on <name>"`. `unlock(name)`: `reparentWork(name, work)`, clear config. Hook `hooks/pre-commit`: if branch is work prefix and `git config branch.<live>.giteslocked = true`, print message, exit 1. `installHook` generalized to install both `pre-push` and `pre-commit` (markers `# gites pre-push hook`, `# gites pre-commit hook`).

- [ ] Test: set config locked, run pre-commit hook script via `bash hooks/pre-commit` in sandbox on `gites-a`: exit 1 with message; on `a`: exit 0. `isLocked` round trip.
- [ ] Implement lock.ts, hook, ship refuse (after `refreshLock`), switch checks out live when locked, resync refreshes, `gites unlock <name>` command, TUI item.
- [ ] Commit `feat(gites): PR lock on work branches`.

### Task A6: agent skill install + shell function + docs

**Files:** Create `src/skill.ts`, `src/messages.ts`. Modify `src/cli.ts`, `README.md`, `src/ship.ts`, `src/lock.ts` (use messages). Test `tests/skill.test.ts`.

**Interfaces:** `messages.ts` exports the rule strings (never merge base into work, resolve on live, change-base after squash, parent-first ship, lock, `ship --yes`). `skillMarkdown(): string`. `gites skill-install` writes `~/.claude/skills/gites/SKILL.md` (path override via `GITES_SKILL_DIR` for tests). `start-feature --print-path` prints only the worktree path (or cwd for in-place) on stdout, all else to stderr.

- [ ] Test: `skillMarkdown()` contains each rule; `skillInstall(dir)` writes file.
- [ ] Implement, add `gs` function snippet to README (`gs() { cd "$(gites start-feature "$@" --worktree --print-path)"; }`), help text update, changeset minor.
- [ ] Run `pnpm build && gites skill-install`. Commit `feat(gites): agent skill, print-path`.

## B. ws (`packages/ws`)

### Task B1: package scaffold + config

**Files:** Create `packages/ws/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts,bin/ws.ts,src/cli.ts,src/config.ts,tests/config.test.ts}`. Add `smol-toml` dep.

**Interfaces:** `loadConfig(path = ~/Documents/projects/workspaces.toml): Config`; `resolveWorkspaces(cfg): Workspace[]` where `Workspace = { name, path, url?, layout: Layout, tabs: AgentTabs[], project: string }`, worktree dirs expand to `<project>.<dir>`. `workspaceForCwd(cfg, cwd): string | null`.

- [ ] Test: parse fixture toml (spec 2.1), worktrees dir with two subdirs -> names `npo.X`, `npo.Y`, inherit url/tabs; `workspaceForCwd` matches deepest path.
- [ ] Implement. Commit `feat(ws): package scaffold and config`.

### Task B2: aerospace + app openers

**Files:** Create `src/aerospace.ts`, `src/open.ts`, `src/iterm.ts`. Test `tests/open.test.ts` (openers accept an injected `exec`).

**Interfaces:** `aerospace(args): string` wrapper. `listWindows(): Win[]` (`aerospace list-windows --all --format '%{window-id}|%{app-name}|%{window-title}'`). `newWindowAfter(launch: () => void, appName): Win` diff, throws `no new <app> window` after 5s. `openWorkspace(ws: Workspace, mode: "resume"|"plan"|"new")`: `aerospace workspace <name>`, for each slot missing (by app-name in this workspace) launch and `move-node-to-workspace`, then layout: `aerospace layout h_tiles` root; left column `v_tiles` via `join-with left` on vscode window. iTerm opener via osascript: one window, tabs from `ws.tabs` with agent command per mode (`resume` falls back to `new`), `cd <path>`.
- [ ] Tests on pure parts: window diff, slot planning (which apps to open given existing windows), tab command selection.
- [ ] Implement. Commit `feat(ws): open workspace on aerospace`.

### Task B3: commands

**Files:** Modify `src/cli.ts`. Create `src/commands/{open,task,close,list,whoami,codex-sync,install-hooks}.ts`, `scripts/codex-sync.py` (verbatim from rc.command python block).

- [ ] `ws open <name>|--all`, `ws task <project> <feature> [base]` (runs `gites start-feature <feature> [base] --worktree --print-path` with cwd project path, then open `<project>.<feature>` mode plan), `ws close <name>` (`aerospace list-windows --workspace <name>` then `aerospace close --window-id`), `ws list` (json with `--json`), `ws whoami`, `ws codex-sync`, `ws install-hooks` (see D).
- [ ] Help via cli-kit `formatHelp`. Commit `feat(ws): commands`.

### Task B4: Raycast + install + remove rc.command

**Files:** Create `packages/ws/raycast/{ws-open.sh,ws-open-all.sh,ws-task.sh}` (Raycast Script Command headers). Create `~/Documents/projects/workspaces.toml` from current rc.command lists. Symlink `~/.local/bin/ws`. `brew install --cask nikitabobko/tap/aerospace`, write `~/.config/aerospace/aerospace.toml` (default keys, `after-startup-command = []`, `accordion-padding=0`). Delete `~/Documents/projects/rc.command`. Raycast: add `packages/ws/raycast` as a Script Commands directory (user does this in Raycast prefs; print instruction).
- [ ] Commit `feat(ws): raycast commands`, changeset.

## C. Bell

**Files:** Create `packages/ws/hooks/bell.sh`, `packages/ws/swiftbar/ws-bell.2s.sh`. `ws install-hooks` merges into `~/.claude/settings.json`: `Notification` and `Stop` -> `bell.sh ring`, `UserPromptSubmit` -> `bell.sh clear`. Bell file `~/.ws/bell.json` (array of `{workspace,cwd,reason,time}`), edited with `jq`. SwiftBar plugin: `brew install --cask swiftbar`, plugin dir `~/Library/Application Support/SwiftBar/Plugins`, symlink. Menubar title `hand <n>` (SF symbol `hand.raised.fill` via `| sfimage=hand.raised.fill`), items `name | bash=aerospace param1=workspace param2=<name> terminal=false`.
- [ ] Tests: `bell.sh ring/clear` on a temp file with `WS_BELL_FILE` env.
- [ ] Commit `feat(ws): bell hooks and swiftbar plugin`.

## D. Write guard

**Files:** `~/.claude/hooks/write-guard.sh` (replace jira-guard.sh), `~/.claude/skills/approve/SKILL.md` (replace jira-write), `~/.claude/settings.json` PreToolUse matcher `mcp__atlassian__.*|Bash`.
- [ ] Guard: atlassian read prefixes free; Bash command blocked when matches `gh (pr (create|merge|comment|review|edit|close|ready)|issue|api .*(-X|--method) *(POST|PUT|PATCH|DELETE))` or `git push( |.*)origin` (respect `gites.origin`? keep `origin`). Grant `~/.claude/.write-grant` 10 min.
- [ ] Skill `/approve`: list actions + verbatim messages, confirm, touch grant, perform, rm grant, report. Note: gites ship pushes to origin, so ship is listed as an action.
- [ ] Update memory `project_jira_readonly_guard.md`, notes `mcp-servers.md` atlassian section (in E's repo).

## E. `/ticket` skill + manager role (`npo-cms-frontend/.claude`)

**Files:** Create `.claude/skills/ticket/SKILL.md`, `.claude/skills/manager/SKILL.md`. Modify `.claude/CLAUDE.md` inside `<edit>` list only (notes list) and add notes `.claude/notes/development/agent-workflow.md`.
- [ ] `/ticket <key>`: steps from spec 5.1, including `resume` behavior and the `/loop` polling prompt. Reference existing skills by exact names: `dawn-plan`, `dawn-implement`, `pr-review`, `thermo-nuclear-code-quality-review`, `deslop`, `dawn-scope-audit`, `dawn-pr-prep`, `/approve`, `gites ship --yes`.
- [ ] `/manager`: spec 5.2. Uses `ws task npo <key> [base]`, `ws list --json`, Jira JQL for Frontend team, `gh pr list`, session messaging.
- [ ] Note + CLAUDE.md list entry. Commit in `.claude` repo.
