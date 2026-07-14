import { isGitRepo } from './git.js';

const HELP = `Usage: gites [command]

Commands:
  (default)             Open the interactive TUI
  start-feature <name> [base]  Create <name> + gites-<name> from origin/<base> (default main)
  attach                Create gites-<current> from current origin feature branch
  switch                Switch between gites-managed features (prints path for worktree ones)
  change-base           Re-parent the active feature onto a new base branch (PR chains)
  ship                  Cherry-pick commits to the live branch with custom timestamps
  resync                Pull origin and rebase working branches
  setup                 Re-run first-time setup
  help                  Show this help

PR chains:
  Branch a feature off another feature (not main) and its PR targets that base.
  When the base is squash-merged into its own parent, run change-base to
  re-parent the child (git rebase --onto) — this drops the parent's individual
  commits and avoids duplicate-commit conflicts.

Worktrees:
  With --worktree, start-feature creates the feature in its own git worktree
  under <repo>.worktrees/<name>, so several features can be worked on at once.
  Set 'git config gites.worktree true' to make it the default.

Flags:
  -v, --verbose         Show underlying git output
      --worktree        Create the feature in its own worktree (start-feature)
      --no-worktree     Force in-place checkout even if worktrees are the default
`;

interface CliError extends Error {
  exitCode: number;
}

export async function run(args: string[]): Promise<void> {
  if (!isGitRepo()) throw new Error('not inside a git repo.');

  const filtered: string[] = [];
  let worktree: boolean | undefined;
  for (const a of args) {
    if (a === '--verbose' || a === '-v') {
      process.env.GITES_VERBOSE = '1';
    } else if (a === '--worktree') {
      worktree = true;
    } else if (a === '--no-worktree') {
      worktree = false;
    } else {
      filtered.push(a);
    }
  }
  const [cmd, ...rest] = filtered;

  switch (cmd) {
    case undefined:
    case 'tui': {
      const { tui } = await import('./tui.js');
      return tui();
    }
    case 'start-feature': {
      const { startFeature } = await import('./start-feature.js');
      const { worktreeEnabled } = await import('./worktree.js');
      return startFeature(rest[0], rest[1], worktree ?? worktreeEnabled());
    }
    case 'attach': {
      const { attach } = await import('./attach.js');
      return attach();
    }
    case 'switch': {
      const { switchFeature } = await import('./switch.js');
      return switchFeature();
    }
    case 'change-base': {
      const { changeBase } = await import('./rebase-base.js');
      return changeBase();
    }
    case 'ship': {
      const { ship } = await import('./ship.js');
      return ship();
    }
    case 'resync': {
      const { resync } = await import('./resync.js');
      return resync();
    }
    case 'setup': {
      const { setupWizard } = await import('./setup.js');
      return setupWizard();
    }
    case 'help':
    case '-h':
    case '--help':
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
