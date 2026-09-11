# Agent workflow: gites stacks, ws workspaces, bell, guard, manager

Date: 2026-09-11
Status: approved in brainstorm, not implemented

## Goal

One person runs many tickets in parallel. Each ticket = one worktree, one macOS
desktop, one Claude worker session. A manager session reports and delegates.
Every outward action (Jira write, GitHub write) needs explicit approval.

Build order: 1 gites, 2 ws, 3 bell, 4 guard, 5 ticket skill + manager role.
Each is an independent deliverable.

## 1. gites

### 1.1 Local stack

- `start-feature <name> [base]`: `base` may be a local gites feature, not only
  `origin/<base>`. Work branch `gitpace-<name>` starts from `gitpace-<base>`,
  live `<name>` from local `<base>`. Nothing pushed.
- Base stored per feature as today (`setBaseBranch`). Resolution order for any
  base ref: local gites feature live branch, else `origin/<base>`.
- `ship` on a child:
  - preflight "parent fully shipped": `gitpace-<base>` has no commits beyond
    `<base>`. Otherwise stop: `ship <base> first`.
  - rebase live child onto the current live parent tip before cherry-picking.
  - candidates: `rev-list --reverse --no-merges gitpace-<name> ^<name>
    ^gitpace-<base>` (ancestry, no patch-id).
  - first ship pushes `<name>` and prints the PR target `<base>`.
- `resync`: walks chains in dependency order (parents first).
- `change-base`: new base resolved local-or-origin (same resolution rule).
- Partial child ships while the parent has unshipped work: not supported.

### 1.2 Global timeline

- Floor = newest committer date across all gites live branches, local refs and
  their origin refs. Work branches excluded.
- Session window default start = floor. Session editor clamps window start and
  every hand-moved commit time to the floor.
- The chained rule (child after parent's last commit) is the same floor.
- No per-repo state file.

### 1.3 Non-interactive ship

- `gites ship --yes`: all pending commits, window from floor to now, weekends
  off, sizes-based distribution as in the TUI. Prints the plan (sha, subject,
  timestamp) before applying. Meant for agents after `/approve`.

### 1.4 PR lock

- Locked when `gh pr view <name>` reports an open or merged PR. Cached in git
  config `gites.<name>.locked`, refreshed on ship, switch, resync.
- Locked effects:
  - pre-commit hook on `gitpace-<name>` refuses the commit.
  - `ship` refuses.
  - `switch` checks out `<name>` (live), also for worktrees.
  - Message everywhere: `PR open for <name>, commit on <name>`.
- `gites unlock <name>`: rebases work onto live
  (`rebase --onto <name> <old-live-tip> gitpace-<name>`), clears the lock.
- QA fix branches (`<ticket>-qa-fixes`) are plain git, outside gites.

### 1.5 Agent brief

- `gites skill-install` writes `~/.claude/skills/gites/SKILL.md`.
- Content generated from the same message strings gites prints: never merge
  main into work, resolve conflicts on live, change-base after squash,
  parent-first ship, PR lock, `ship --yes` flow.

### 1.6 Shell

- `gs` zsh function: `cd "$(gites start-feature "$@" --print-path)"`.
- gites never opens terminals or desktops.

## 2. ws (cli-tools package, replaces rc.command)

### 2.1 Config `~/Documents/projects/workspaces.toml`

```toml
[layout.default]
left_top = "chrome"
left_bottom = "vscode"
right = "terminal"

[app.chrome]
open = 'open -na "Google Chrome" --args --new-window {url}'
[app.vscode]
open = "code {path}"
[app.terminal]
open = "iterm"            # built-in opener, one tab per agent

[agent.claude]
new = "claude --permission-mode auto --remote-control"
resume = "claude --permission-mode auto --remote-control --continue resume"
plan = "claude --permission-mode plan --remote-control"
[agent.codex]
new = "codex --ask-for-approval never --sandbox workspace-write"
resume = "codex resume --last --ask-for-approval never --sandbox workspace-write"

[project.huntout]
path = "huntout"
tabs = ["claude", "codex"]

[project.npo]
path = "dawn/npo-cms-frontend"
worktrees = "dawn/npo-cms-frontend.worktrees"
url = "http://localhost:5173"
tabs = ["claude"]
```

- Projects listed explicitly, no directory loop. Defaults: `layout = "default"`,
  `tabs = ["claude"]`.
- Worktrees are the only loop: each dir under `worktrees` becomes workspace
  `<project>.<dir>` inheriting the project entry.

### 2.2 Desktops

- AeroSpace workspaces, flat, named `<project>` or `<project>.<task>`.
  Alphabetical order groups tasks under their project prefix. No nesting.
- Workspace layout: `h_tiles` root, left `v_tiles` container (chrome over
  vscode), right terminal. 50/50.
- Window placement: `ws` diffs `aerospace list-windows --all` before and after
  each launch to find the new window id, moves it to the workspace, places it
  in its slot. If no new window appears, `ws` reports it and stops (no guess).

### 2.3 Commands

- `ws open <name>`: create or focus workspace, open missing slots only.
  Terminal: one iTerm window, one tab per agent, `resume` then `new` fallback.
- `ws open --all`: every project and every existing worktree.
- `ws task <project> <feature> [base]`: `gites start-feature <feature> [base]
  --worktree` inside the project, then `ws open <project>.<feature>` with the
  first tab using the agent's `plan` command.
- `ws close <name>`: close the workspace's windows.
- `ws list`: names, exists, open. Used by Raycast and the manager.
- `ws whoami`: workspace name for the cwd. Used by hooks.
- `ws codex-sync`: rc.command's python block moved verbatim; run by
  `open --all` when any project lists `codex`.
- `ws install-hooks`: writes the bell hooks into `~/.claude/settings.json`.

### 2.4 Raycast

- Script Commands `ws open` (text arg, fuzzy on `ws list`), `ws open all`,
  `ws task` (project, feature, base). Thin wrappers.

### 2.5 Removed

- `~/Documents/projects/rc.command`.

## 3. Bell

- Claude Code hooks `Notification` and `Stop`: append
  `{workspace, cwd, reason, time}` to `~/.ws/bell.json` (workspace from
  `ws whoami`). `UserPromptSubmit`: remove the cwd's entry.
- SwiftBar plugin, 2s refresh: hand icon with count, dropdown of waiting
  workspaces, click runs `aerospace workspace <name>`.
- Installed by `ws install-hooks`.

## 4. Write guard

- `~/.claude/hooks/jira-guard.sh` becomes `write-guard.sh`. Reads free.
  Blocked without a grant: atlassian non-read tools, Bash matching
  `gh pr (create|merge|comment|review|edit|close)`, `gh issue`, `gh api`
  with non-GET, `git push` to `origin`.
- `/approve` replaces `/jira-write`: agent lists every action and message
  verbatim, user confirms, grant file `~/.claude/.write-grant` valid 10 min,
  removed after use. One grant covers a batch.
- Slack: no tooling. Agent hands the user the message text plus links.

## 5. Ticket skill and manager role (npo-cms-frontend `.claude`)

### 5.1 `/ticket <key>` (worker)

1. Read ticket from Jira. AC dominate; missing AC or QA steps get flagged to
   the user before planning.
2. Plan mode, wait for approval (bell rings).
3. Implement, tests, e2e, typecheck, lint. Then `/pr-review`,
   `/thermo-nuclear-code-quality-review`, `/deslop`, fix findings.
4. Report: PR title, PR message with AC checklist, QA steps, Jira gaps. Plain
   characters only. Wait for go.
5. After `/approve`: `gites ship --yes`, `gh pr create`, request Copilot
   review, Jira to Review when human reviewers are added.
6. `/loop` polling: Copilot comments, CI, human reviews, Jira QA comments.
   Fix, re-request, report. Slack ping text handed to the user.
7. `resume` prompt (from `agent.claude.resume`): read state from gh and Jira,
   re-arm the loop if the PR is still open.
8. Approved: after ok, merge, pull main, `gites cleanup`, Jira to QA,
   `ws close`.
9. QA findings: verify against AC, if in scope: `<key>-qa-fixes` plain branch
   in a new worktree, same loop from step 2.

### 5.2 Manager (main checkout, workspace `npo`)

- Report: Jira board (Frontend team), open PRs, review and CI state, worker
  status via session messages. One short table.
- Delegate: `ws task npo <key> [base]` plus ticket brief to the worker, Jira to
  In Progress after `/approve`. Forwards user instructions to workers
  ("ship 597").
- Holds no ticket state. Never merges, never writes outward.
- Manager and workers use Claude Code local session messaging.

## Out of scope

- Slack MCP. Nested desktops. Partial child ships. Per-repo timeline file.
- Claude cloud routines for polling while the laptop is closed.
