import { isGitRepo } from "./git.js";

const HELP = `Usage: gites [command]

Commands:
  (default)             Open the interactive TUI
  start-feature <name> [base]  Create <name> + gites-<name> from origin/<base> (default main)
  attach                Create gites-<current> from current origin feature branch
  switch                Switch between gites-managed features (prints path for worktree ones)
  change-base           Re-parent the active feature onto a new base branch (PR chains)
  ship [--yes]          Cherry-pick commits to the live branch with custom timestamps
                        (--yes: all pending commits, floor..now, weekends off, no prompts)
  resync                Pull origin and rebase working branches
  unlock [name]         Reopen a feature's work branch after its PR locked it
  cleanup               Prune finished features (local + backup only, never origin)
  config                Change settings (branch prefix, worktrees, backup remote)
  setup                 Re-run first-time setup
  skill-install         Write the gites rules as a Claude skill (~/.claude/skills/gites)
  help                  Show this help

PR chains:
  Branch a feature off another feature (not main) and its PR targets that base.
  When the base is squash-merged into its own parent, run change-base to
  re-parent the child (git rebase --onto) - this drops the parent's individual
  commits and avoids duplicate-commit conflicts.

PR lock:
  Once a PR exists for <name> (open or merged, checked via gh), gites-<name> is
  locked: commits there are refused by the pre-commit hook, ship refuses, and
  switch checks out <name>. Follow-up work (review fixes, main merges) lands on
  <name> directly. 'gites unlock' rebases the work branch onto <name> and
  reopens it.

Worktrees:
  With --worktree, start-feature creates the feature in its own git worktree
  under <repo>.worktrees/<name>, so several features can be worked on at once.
  Set 'git config gites.worktree true' to make it the default.

Flags:
  -v, --verbose         Show underlying git output
      --worktree        Create the feature in its own worktree (start-feature)
      --no-worktree     Force in-place checkout even if worktrees are the default
      --print-path      start-feature: print only the feature path on stdout
                        (shell: gs() { cd "$(gites start-feature "$@" --print-path)"; })
`;

interface CliError extends Error {
  exitCode: number;
}

export async function run(args: string[]): Promise<void> {
  if (!isGitRepo()) throw new Error("not inside a git repo.");

  const filtered: string[] = [];
  let worktree: boolean | undefined;
  let yes = false;
  let printPath = false;
  for (const a of args) {
    if (a === "--verbose" || a === "-v") {
      process.env.GITES_VERBOSE = "1";
    } else if (a === "--worktree") {
      worktree = true;
    } else if (a === "--no-worktree") {
      worktree = false;
    } else if (a === "--yes" || a === "-y") {
      yes = true;
    } else if (a === "--print-path") {
      printPath = true;
    } else {
      filtered.push(a);
    }
  }
  const [cmd, ...rest] = filtered;

  switch (cmd) {
    case undefined:
    case "tui": {
      const { tui } = await import("./tui.js");
      return tui();
    }
    case "start-feature": {
      const { startFeature } = await import("./start-feature.js");
      const { worktreeEnabled } = await import("./worktree.js");
      return startFeature(rest[0], rest[1], worktree ?? worktreeEnabled(), { printPath });
    }
    case "attach": {
      const { attach } = await import("./attach.js");
      return attach();
    }
    case "switch": {
      const { switchFeature } = await import("./switch.js");
      return switchFeature();
    }
    case "change-base": {
      const { changeBase } = await import("./rebase-base.js");
      return changeBase();
    }
    case "ship": {
      const { ship } = await import("./ship.js");
      return ship({ yes });
    }
    case "unlock": {
      const { unlock } = await import("./lock.js");
      const { resolveLiveBranch } = await import("./feature.js");
      const name = rest[0] ?? resolveLiveBranch().live;
      if (!name) throw new Error("Usage: gites unlock <name>");
      return unlock(name);
    }
    case "resync": {
      const { resync } = await import("./resync.js");
      return resync();
    }
    case "cleanup": {
      const { cleanup } = await import("./cleanup.js");
      return cleanup();
    }
    case "config": {
      const { settingsMenu } = await import("./settings.js");
      return settingsMenu();
    }
    case "setup": {
      const { setupWizard } = await import("./setup.js");
      return setupWizard();
    }
    case "skill-install": {
      const { installSkill } = await import("./skill.js");
      console.log(`Wrote ${installSkill()}`);
      return;
    }
    case "help":
    case "-h":
    case "--help":
      console.log(HELP);
      return;
    default: {
      console.error(`Unknown command: ${cmd}`);
      console.error(HELP);
      const err = new Error() as CliError;
      err.exitCode = 2;
      throw err;
    }
  }
}
