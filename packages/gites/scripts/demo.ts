#!/usr/bin/env node
import { execFileSync, spawnSync, type ExecFileSyncOptions } from 'node:child_process';
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { select } from '@inquirer/prompts';
import pc from 'picocolors';

const PKG_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const DEMO_ROOT = join(tmpdir(), 'gitpace-demo');
const ORIGIN_REPO = join(DEMO_ROOT, 'origin.git');
const GITPACE_REPO = join(DEMO_ROOT, 'gitpace.git');
const WORK_DIR = join(DEMO_ROOT, 'work');

function sh(cmd: string, args: string[], opts: ExecFileSyncOptions = {}): string {
  return execFileSync(cmd, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    ...opts,
  }) as string;
}

function shIn(dir: string, cmd: string, args: string[]): string {
  return sh(cmd, args, { cwd: dir });
}

function wipe(): void {
  rmSync(DEMO_ROOT, { recursive: true, force: true });
}

function ensureBareRepos(): void {
  mkdirSync(DEMO_ROOT, { recursive: true });
  if (!existsSync(ORIGIN_REPO)) sh('git', ['init', '--bare', ORIGIN_REPO]);
  if (!existsSync(GITPACE_REPO)) sh('git', ['init', '--bare', GITPACE_REPO]);
}

function cloneWork(): void {
  sh('git', ['clone', ORIGIN_REPO, WORK_DIR]);
  shIn(WORK_DIR, 'git', ['config', 'user.email', 'demo@example.com']);
  shIn(WORK_DIR, 'git', ['config', 'user.name', 'Demo User']);
  writeFileSync(join(WORK_DIR, 'README.md'), '# Demo project\n\nFake repo for poking at gitpace.\n');
  shIn(WORK_DIR, 'git', ['add', 'README.md']);
  shIn(WORK_DIR, 'git', ['commit', '-m', 'initial commit']);
  shIn(WORK_DIR, 'git', ['push', 'origin', 'main']);
}

function runSetupNonInteractive(): void {
  shIn(WORK_DIR, 'git', ['remote', 'add', 'gitpace', GITPACE_REPO]);
  const hookSrc = join(PKG_ROOT, 'hooks', 'pre-push');
  const hookDst = join(WORK_DIR, '.git', 'hooks', 'pre-push');
  sh('cp', [hookSrc, hookDst]);
  sh('chmod', ['+x', hookDst]);
  shIn(WORK_DIR, 'git', ['push', 'gitpace', 'main']);
}

function appendFile(name: string, content: string): void {
  writeFileSync(join(WORK_DIR, name), content, { flag: 'a' });
}

function commit(msg: string, file = 'file.txt'): void {
  appendFile(file, `${msg} — ${Date.now()}\n`);
  shIn(WORK_DIR, 'git', ['add', file]);
  shIn(WORK_DIR, 'git', ['commit', '-m', msg]);
}

function startFeature(name: string, commits: string[] = []): void {
  shIn(WORK_DIR, 'git', ['checkout', 'main']);
  shIn(WORK_DIR, 'git', ['checkout', '-b', name]);
  shIn(WORK_DIR, 'git', ['push', '-u', 'origin', name]);
  shIn(WORK_DIR, 'git', ['checkout', '-b', `gitpace-${name}`]);
  shIn(WORK_DIR, 'git', ['push', '-u', 'gitpace', `gitpace-${name}`]);
  shIn(WORK_DIR, 'git', ['config', 'gitpace.branch', name]);
  for (const msg of commits) commit(msg, `${name}.txt`);
}

function teammatePush(): void {
  const dir = join(DEMO_ROOT, `teammate-${Date.now()}`);
  mkdirSync(dir);
  sh('git', ['clone', ORIGIN_REPO, dir]);
  shIn(dir, 'git', ['config', 'user.email', 'teammate@example.com']);
  shIn(dir, 'git', ['config', 'user.name', 'Teammate']);
  writeFileSync(join(dir, 'README.md'), `\nteammate edit ${Date.now()}\n`, { flag: 'a' });
  shIn(dir, 'git', ['add', 'README.md']);
  shIn(dir, 'git', ['commit', '-m', 'teammate: doc tweak']);
  shIn(dir, 'git', ['push', 'origin', 'main']);
  rmSync(dir, { recursive: true, force: true });
}

interface Scenario {
  label: string;
  seed(): void;
}

const SCENARIOS: Record<string, Scenario> = {
  fresh: {
    label: 'Fresh repo (walk through first-run setup wizard)',
    seed() {
      ensureBareRepos();
      cloneWork();
      console.log('');
      console.log(pc.bold('When the setup wizard asks for the gitpace remote URL, paste:'));
      console.log(pc.cyan(`  ${GITPACE_REPO}`));
      console.log('');
    },
  },
  ready: {
    label: 'Setup done, no features yet (start a new feature)',
    seed() {
      ensureBareRepos();
      cloneWork();
      runSetupNonInteractive();
    },
  },
  active: {
    label: 'Active feature with local commits (ready to ship)',
    seed() {
      ensureBareRepos();
      cloneWork();
      runSetupNonInteractive();
      startFeature('auth-flow', [
        'add user model',
        'add auth routes',
        'wire up middleware',
        'add login form',
        'fix session bug',
      ]);
    },
  },
  multi: {
    label: 'Multiple features (try switch)',
    seed() {
      ensureBareRepos();
      cloneWork();
      runSetupNonInteractive();
      startFeature('auth-flow', ['add user model', 'add auth routes']);
      startFeature('billing', ['add invoice model', 'add stripe webhook']);
      startFeature('search', ['index documents']);
    },
  },
  teammate: {
    label: 'Teammate pushed to origin (try resync)',
    seed() {
      ensureBareRepos();
      cloneWork();
      runSetupNonInteractive();
      startFeature('auth-flow', ['add user model', 'add auth routes']);
      teammatePush();
      teammatePush();
    },
  },
  attachable: {
    label: 'Origin branch exists, no local- counterpart (try attach)',
    seed() {
      ensureBareRepos();
      cloneWork();
      runSetupNonInteractive();
      shIn(WORK_DIR, 'git', ['checkout', '-b', 'orphan-feat']);
      commit('existing work on orphan-feat', 'orphan.txt');
      shIn(WORK_DIR, 'git', ['push', '-u', 'origin', 'orphan-feat']);
    },
  },
};

function printState(): void {
  console.log('');
  console.log(pc.dim('Demo sandbox:'));
  console.log(pc.dim(`  work:   ${WORK_DIR}`));
  console.log(pc.dim(`  origin: ${ORIGIN_REPO}`));
  console.log(pc.dim(`  gitpace: ${GITPACE_REPO}`));
  console.log('');
}

function launchTui(): number {
  // Run via tsx so the demo works directly from source (no build step required).
  const r = spawnSync('npx', ['tsx', join(PKG_ROOT, 'bin', 'gitpace.ts')], {
    cwd: WORK_DIR,
    stdio: 'inherit',
  });
  return r.status ?? 0;
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const reset = args.includes('--reset');
  const scenarioArg = args.find((a) => !a.startsWith('--'));

  if (reset) {
    wipe();
    console.log(pc.green('Demo sandbox wiped.'));
    if (!scenarioArg) return;
  }

  let scenario = scenarioArg;
  if (!scenario) {
    scenario = await select<string>({
      message: 'Pick a demo scenario',
      choices: Object.entries(SCENARIOS).map(([key, { label }]) => ({
        name: `${key.padEnd(11)} — ${label}`,
        value: key,
      })),
      pageSize: 10,
    });
  }

  const sc = SCENARIOS[scenario];
  if (!sc) {
    console.error(pc.red(`Unknown scenario: ${scenario}`));
    console.error('Available: ' + Object.keys(SCENARIOS).join(', '));
    process.exit(2);
  }

  if (existsSync(WORK_DIR)) {
    console.log(pc.yellow(`Existing sandbox at ${DEMO_ROOT} — wiping for clean run.`));
    wipe();
  }

  console.log(pc.bold(pc.magenta(`Seeding scenario: ${scenario}`)));
  sc.seed();
  printState();
  console.log(pc.bold('Launching gitpace TUI in the sandbox. Ctrl+C or "Quit" to exit.'));
  console.log('');
  process.exit(launchTui());
}

main().catch((err: Error & { name?: string }) => {
  if (err?.name === 'ExitPromptError') process.exit(0);
  console.error(err);
  process.exit(1);
});
