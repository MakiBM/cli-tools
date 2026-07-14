import { cpSync, existsSync, readdirSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { git, gitTry, gitRun, getConfig } from './git.js';
import { workBranch } from './feature.js';

export interface Worktree {
  path: string;
  branch: string;
}

function mainRoot(): string {
  const commonDir = git('rev-parse', '--path-format=absolute', '--git-common-dir');
  return dirname(commonDir.replace(/\/$/, ''));
}

export function worktreesRoot(): string {
  const root = mainRoot();
  return join(dirname(root), `${basename(root)}.worktrees`);
}

export function worktreePath(name: string): string {
  return join(worktreesRoot(), name);
}

export function listWorktrees(): Worktree[] {
  const raw = gitTry('worktree', 'list', '--porcelain');
  const out: Worktree[] = [];
  let path = '';
  let branch = '';
  for (const line of raw.split('\n')) {
    if (line.startsWith('worktree ')) {
      path = line.slice('worktree '.length);
    } else if (line.startsWith('branch ')) {
      branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    } else if (line === '') {
      if (path) out.push({ path, branch });
      path = '';
      branch = '';
    }
  }
  if (path) out.push({ path, branch });
  return out;
}

export function worktreeForFeature(name: string): string {
  const work = workBranch(name);
  const wt = listWorktrees().find((w) => w.branch === work);
  return wt ? wt.path : '';
}

export function branchCheckedOutElsewhere(branch: string): boolean {
  return listWorktrees().some((w) => w.branch === branch && w.path !== process.cwd());
}

function copyLocalArtifacts(from: string, to: string): void {
  for (const entry of readdirSync(from)) {
    if (entry === '.claude' || entry.startsWith('.env')) {
      const src = join(from, entry);
      if (existsSync(src)) cpSync(src, join(to, entry), { recursive: true });
    }
  }
}

export async function addWorktree(name: string, live: string): Promise<string> {
  const path = worktreePath(name);
  await gitRun('worktree', 'add', path, '-b', workBranch(name), live);
  copyLocalArtifacts(mainRoot(), path);
  return path;
}

export async function removeWorktree(path: string): Promise<void> {
  await gitRun('worktree', 'remove', path);
}

export function worktreeEnabled(): boolean {
  return getConfig('gitpace.worktree') === 'true';
}
