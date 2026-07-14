import {
  execFileSync,
  spawnSync,
  type ExecFileSyncOptions,
  type SpawnSyncOptions,
  type SpawnSyncReturns,
} from 'node:child_process';
import { mkdtempSync, rmSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

export const TEST_ORIGIN = 'test-origin';
export const TEST_REMOTE = 'test-gites';

export interface SandboxContext {
  sandbox: string;
  origin: string;
  remote: string;
  work: string;
}

export function setupSandbox(): SandboxContext {
  const sandbox = mkdtempSync(join(tmpdir(), 'gites-test-'));
  const origin = join(sandbox, 'origin.git');
  const remote = join(sandbox, 'gites.git');
  const work = join(sandbox, 'work');

  run('git', ['init', '--bare', origin]);
  run('git', ['init', '--bare', remote]);
  run('git', ['clone', '--origin', TEST_ORIGIN, origin, work]);

  const prev = process.cwd();
  process.chdir(work);
  try {
    run('git', ['config', 'user.email', 'test@test.com']);
    run('git', ['config', 'user.name', 'Test']);
    run('git', ['config', 'gites.origin', TEST_ORIGIN]);
    run('git', ['config', 'gites.remote', TEST_REMOTE]);
    writeFileSync(join(work, 'README.md'), 'init\n');
    run('git', ['add', 'README.md']);
    run('git', ['commit', '-m', 'initial commit']);
    run('git', ['push', TEST_ORIGIN, 'main']);
    run('git', ['remote', 'add', TEST_REMOTE, remote]);
    run('git', ['push', TEST_REMOTE, 'main']);
  } finally {
    process.chdir(prev);
  }

  return { sandbox, origin, remote, work };
}

export function teardown(sandbox: string): void {
  rmSync(sandbox, { recursive: true, force: true });
}

export async function inDir<T>(dir: string, fn: () => Promise<T> | T): Promise<T> {
  const prev = process.cwd();
  process.chdir(dir);
  try {
    return await fn();
  } finally {
    process.chdir(prev);
  }
}

export function run(cmd: string, args: string[], opts: ExecFileSyncOptions = {}): string {
  return execFileSync(cmd, args, { encoding: 'utf8', stdio: 'pipe', ...opts }) as string;
}

export function runTry(
  cmd: string,
  args: string[],
  opts: SpawnSyncOptions = {},
): SpawnSyncReturns<string> {
  return spawnSync(cmd, args, {
    encoding: 'utf8',
    stdio: 'pipe',
    ...opts,
  }) as SpawnSyncReturns<string>;
}

export function branchExists(name: string): boolean {
  return spawnSync('git', ['show-ref', '--verify', '--quiet', `refs/heads/${name}`]).status === 0;
}

export function remoteHasBranch(remote: string, branch: string): boolean {
  const out = run('git', ['ls-remote', '--heads', remote, branch]);
  return out.includes(branch);
}

export function makeCommit(msg = 'change'): void {
  writeFileSync(join(process.cwd(), 'file.txt'), `${Date.now()}-${Math.random()}\n`, {
    flag: 'a',
  });
  run('git', ['add', 'file.txt']);
  run('git', ['commit', '-m', msg]);
}

export function teammatePush(originRepo: string, sandbox: string): void {
  const dir = join(sandbox, `teammate-${Date.now()}`);
  mkdirSync(dir);
  run('git', ['clone', originRepo, dir]);
  const prev = process.cwd();
  process.chdir(dir);
  try {
    run('git', ['config', 'user.email', 'teammate@test.com']);
    run('git', ['config', 'user.name', 'Teammate']);
    writeFileSync(join(dir, 'README.md'), `teammate ${Date.now()}\n`, { flag: 'a' });
    run('git', ['add', 'README.md']);
    run('git', ['commit', '-m', 'teammate commit']);
    run('git', ['push', 'origin', 'main']);
  } finally {
    process.chdir(prev);
  }
  rmSync(dir, { recursive: true, force: true });
}
