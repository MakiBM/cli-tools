import { search } from '@inquirer/prompts';
import { gitTry } from './git.js';
import { isWorkBranch } from './feature.js';
import { originRemote } from './remotes.js';

function listBranches(exclude: string[]): string[] {
  const origin = originRemote();
  const refs = gitTry(
    'for-each-ref',
    '--format=%(refname:short)',
    'refs/heads/',
    `refs/remotes/${origin}/`,
  )
    .split('\n')
    .filter(Boolean);

  const skip = new Set(exclude);
  const seen = new Set<string>();
  const out: string[] = [];
  for (const ref of refs) {
    const name = ref.startsWith(`${origin}/`) ? ref.slice(origin.length + 1) : ref;
    if (name === 'HEAD' || isWorkBranch(name) || skip.has(name) || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
  }

  out.sort((a, b) => (a === 'main' ? -1 : b === 'main' ? 1 : a.localeCompare(b)));
  return out;
}

export async function pickBranch(opts: { message: string; exclude?: string[] }): Promise<string> {
  const branches = listBranches(opts.exclude ?? []);
  return search<string>({
    message: opts.message,
    source: (term) => {
      const q = (term ?? '').toLowerCase();
      return branches
        .filter((b) => b.toLowerCase().includes(q))
        .map((b) => ({ name: b, value: b }));
    },
  });
}
