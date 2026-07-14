import { spawnSync } from 'node:child_process';
import { input, confirm } from '@inquirer/prompts';
import pc from 'picocolors';
import { git, gitTry, hasRemote, isGitRepo } from './git.js';
import { originRemote, gitesRemote } from './remotes.js';
import { worktreeEnabled } from './worktree.js';
import { printBanner } from './banner.js';
import { installHook, isHookInstalled } from './hook-install.js';

interface RemoteCheck {
  ok: boolean;
  stderr: string;
}

function checkRemoteReachable(url: string): RemoteCheck {
  const r = spawnSync('git', ['ls-remote', url], {
    stdio: ['ignore', 'ignore', 'pipe'],
    encoding: 'utf8',
    timeout: 15000,
  });
  return { ok: r.status === 0, stderr: r.stderr || '' };
}

export function needsSetup(): boolean {
  if (!hasRemote(gitesRemote())) return true;
  if (!isHookInstalled()) return true;
  return false;
}

export interface SetupOptions {
  originName?: string;
  remoteName?: string;
  worktree?: boolean;
}

export function runSetup(
  remoteUrl: string,
  { originName = 'origin', remoteName = 'gites', worktree }: SetupOptions = {},
): void {
  if (!isGitRepo()) throw new Error('not inside a git repo');

  if (originName !== 'origin') git('config', 'gites.origin', originName);
  if (remoteName !== 'gites') git('config', 'gites.remote', remoteName);
  if (worktree !== undefined) git('config', 'gites.worktree', String(worktree));

  if (remoteUrl) {
    if (!hasRemote(remoteName)) {
      git('remote', 'add', remoteName, remoteUrl);
    } else {
      git('remote', 'set-url', remoteName, remoteUrl);
    }
  }

  installHook();
}

export async function setupWizard(): Promise<void> {
  console.clear();
  printBanner();

  console.log(pc.bold('First-time Setup'));
  console.log('');

  const originName = originRemote();
  const remoteName = gitesRemote();

  const originUrl = gitTry('remote', 'get-url', originName);
  if (originUrl) {
    console.log(`${pc.green('✔')} Origin remote: ${pc.cyan(originUrl)}`);
  } else {
    console.log(`${pc.yellow('!')} Origin remote '${originName}' not set yet.`);
  }
  console.log('');

  const existingRemote = gitTry('remote', 'get-url', remoteName);

  let remoteUrl = '';
  let suggested = existingRemote || 'git@github.com:you/gites-work.git';
  let skipFirstValidate = false;

  if (existingRemote) {
    console.log(`${pc.green('✔')} Gites remote found: ${pc.cyan(existingRemote)}`);
    const keep = await confirm({ message: 'Keep this URL?', default: true });
    if (keep) {
      remoteUrl = existingRemote;
      skipFirstValidate = true;
    }
  }

  for (;;) {
    if (!remoteUrl) {
      remoteUrl = await input({
        message: `Gites remote (your own repo for the '${remoteName}/*' work branches):`,
        default: suggested,
      });
    }
    if (!remoteUrl) {
      console.log(pc.yellow('No URL provided. You can re-run setup later.'));
      return;
    }
    if (skipFirstValidate) {
      skipFirstValidate = false;
      break;
    }
    process.stdout.write(pc.dim(`  Checking ${remoteUrl}... `));
    const { ok, stderr } = checkRemoteReachable(remoteUrl);
    if (ok) {
      console.log(pc.green('reachable'));
      break;
    }
    console.log(pc.red('unreachable'));
    const firstLine = stderr.split('\n').find((l) => l.trim()) || 'unknown error';
    console.log(pc.dim(`  ${firstLine}`));
    suggested = remoteUrl;
    remoteUrl = '';
  }

  if (originName !== 'origin') git('config', 'gites.origin', originName);
  if (remoteName !== 'gites') git('config', 'gites.remote', remoteName);

  if (remoteUrl) {
    if (!hasRemote(remoteName)) {
      git('remote', 'add', remoteName, remoteUrl);
    } else {
      git('remote', 'set-url', remoteName, remoteUrl);
    }
  }

  console.log('');
  console.log(pc.bold('Worktrees'));
  console.log(pc.dim('  Give each new feature its own worktree so you can work on several at once.'));
  const worktree = await confirm({ message: 'Default new features to their own worktree?', default: worktreeEnabled() });
  git('config', 'gites.worktree', String(worktree));

  console.log('');
  console.log(pc.bold('Git hook'));
  console.log(
    pc.dim(`  Installs a pre-push hook into this clone, blocks '${remoteName}/*' branches from reaching origin.`),
  );
  const hook = installHook();
  console.log(`${pc.green('✔')} Hook installed at ${pc.cyan(hook.path)}`);
  if (hook.underHooksPath) {
    console.log(pc.dim('  (placed under your existing core.hooksPath)'));
  }
  if (hook.replacedExisting && hook.backupPath) {
    console.log(pc.yellow(`  ! Existing pre-push backed up to ${hook.backupPath}`));
  }

  console.log('');
  console.log(pc.bold(pc.green('✔ Setup complete!')));
  console.log('');
}
