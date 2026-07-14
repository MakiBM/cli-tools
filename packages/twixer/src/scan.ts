import * as fs from 'node:fs';
import * as path from 'node:path';
import { globSync } from 'glob';
import ignoreLib from 'ignore';
import { lookupReplacement } from './matching.js';
import { loadTheme, type ThemeAddition } from './theme-loader.js';

// Matches Tailwind arbitrary-value utility classes. The trailing
// (?!(?:\/[\w-]+)?:) rejects arbitrary VARIANT selectors (`data-[…]:`,
// `group-data-[…]/name:`) which end with `]:` or `]/name:`.
export const ARB_RE =
  /(?<![\w-])((?:[a-zA-Z0-9_\-/]+(?:\[[^\]]*\])?(?:\/[\w-]+)?:)*!?-?[a-zA-Z][a-zA-Z0-9-]*-)\[([^[\]\s'"`<>{}]+(?:\([^()]*\)[^[\]\s'"`<>{}]*)*)\](?!(?:\/[\w-]+)?:)/g;

export interface ArbitraryClass {
  full: string;
  prefix: string;
  value: string;
  index: number;
}

/** Extract every arbitrary-value class occurrence from a source string. */
export const extractArbitraryClasses = (text: string): ArbitraryClass[] => {
  const out: ArbitraryClass[] = [];
  ARB_RE.lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = ARB_RE.exec(text)) !== null) {
    out.push({
      full: m[0],
      prefix: m[1].replace(/-$/, ''),
      value: m[2],
      index: m.index,
    });
  }
  return out;
};

const DEFAULT_EXTS = '{js,jsx,ts,tsx,mjs,cjs,vue,svelte,astro,html,htm,mdx}';

const DEFAULT_IGNORE = [
  '**/node_modules/**',
  '**/.git/**',
  '**/dist/**',
  '**/build/**',
  '**/.next/**',
  '**/out/**',
  '**/coverage/**',
  '**/.turbo/**',
  '**/.cache/**',
];

export interface Hit {
  file: string;
  line: number;
  col: number;
  cls: string;
  prefix: string;
  value: string;
  replacement: string | null;
  approx: boolean;
}

export interface ScanOptions {
  /** Directories or globs to scan. Defaults to the whole cwd. */
  patterns?: string[];
  cwd?: string;
  ignore?: string[];
  useGitignore?: boolean;
  useUserTheme?: boolean;
  themeFiles?: string[];
  /** Suggest the nearest token when there's no exact match. */
  round?: boolean;
  /** Include arbitrary classes with no replacement. */
  all?: boolean;
  /** Explicit framework theme.css. `undefined` = auto-resolve, `null` = skip. */
  tailwindThemeCss?: string | null;
}

export interface ScanResult {
  hits: Hit[];
  additions: ThemeAddition[];
  spacingBasePx: number | null;
  fileCount: number;
  patterns: string[];
}

type Ignore = ReturnType<typeof ignoreLib>;

const expandIfDir = (p: string): string => {
  try {
    if (fs.statSync(p).isDirectory()) return path.join(p, `**/*.${DEFAULT_EXTS}`);
  } catch {}
  return p;
};

const deriveRoots = (patterns: string[], cwd: string): string[] => {
  const roots = new Set<string>();
  for (const p of patterns) {
    const cleanRoot = p.split('**')[0].replace(/[\\/]$/, '');
    if (cleanRoot && fs.existsSync(cleanRoot)) {
      try {
        const stat = fs.statSync(cleanRoot);
        roots.add(stat.isDirectory() ? cleanRoot : path.dirname(cleanRoot));
      } catch {}
    }
  }
  if (!roots.size) roots.add(cwd);
  return [...roots];
};

const makeGitignoreChecker = (enabled: boolean): ((absFile: string) => boolean) => {
  const cache = new Map<string, Ignore | null>();
  const loadChain = (startDir: string): Array<{ dir: string; ig: Ignore }> => {
    const chain: Array<{ dir: string; ig: Ignore }> = [];
    let dir = path.resolve(startDir);
    while (true) {
      if (cache.has(dir)) {
        const cached = cache.get(dir);
        if (cached) chain.push({ dir, ig: cached });
      } else {
        let ig: Ignore | null = null;
        try {
          ig = ignoreLib().add(fs.readFileSync(path.join(dir, '.gitignore'), 'utf8'));
        } catch {}
        cache.set(dir, ig);
        if (ig) chain.push({ dir, ig });
      }
      const parent = path.dirname(dir);
      if (parent === dir) break;
      if (fs.existsSync(path.join(dir, '.git'))) break;
      dir = parent;
    }
    return chain;
  };
  return (absFile: string): boolean => {
    if (!enabled) return false;
    for (const { dir, ig } of loadChain(path.dirname(absFile))) {
      const rel = path.relative(dir, absFile);
      if (!rel || rel.startsWith('..')) continue;
      if (ig.ignores(rel)) return true;
    }
    return false;
  };
};

const lineColOf = (lineStarts: number[], idx: number): { line: number; col: number } => {
  let lo = 0;
  let hi = lineStarts.length - 1;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (lineStarts[mid] <= idx) lo = mid;
    else hi = mid - 1;
  }
  return { line: lo + 1, col: idx - lineStarts[lo] + 1 };
};

/**
 * Scan files for Tailwind arbitrary-value classes and resolve each to its
 * default-token replacement. Pure of console/exit — returns structured hits.
 */
export const scan = (options: ScanOptions = {}): ScanResult => {
  const cwd = options.cwd ?? process.cwd();
  const useGitignore = options.useGitignore ?? true;
  const ignore = [...DEFAULT_IGNORE, ...(options.ignore ?? [])];
  const patterns = (options.patterns?.length ? options.patterns : [`**/*.${DEFAULT_EXTS}`]).map(
    expandIfDir,
  );
  const roots = deriveRoots(patterns, cwd);
  const isGitIgnored = makeGitignoreChecker(useGitignore);

  const { theme, additions } = loadTheme({
    roots,
    ignore,
    useGitignore,
    isGitIgnored,
    useUserTheme: options.useUserTheme ?? true,
    themeFiles: options.themeFiles ?? [],
    tailwindThemeCss: options.tailwindThemeCss,
  });

  let files: string[] = [];
  for (const p of patterns) {
    files = files.concat(
      globSync(p, { cwd, ignore, nodir: true, dot: false, absolute: true }),
    );
  }
  files = [...new Set(files)];
  if (useGitignore) files = files.filter((f) => !isGitIgnored(f));

  const round = options.round ?? false;
  const all = options.all ?? false;
  const hits: Hit[] = [];

  for (const file of files) {
    let text: string;
    try {
      text = fs.readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (!text.includes('-[')) continue;

    const lineStarts = [0];
    for (let i = 0; i < text.length; i++) {
      if (text.charCodeAt(i) === 10) lineStarts.push(i + 1);
    }

    for (const cls of extractArbitraryClasses(text)) {
      const r = lookupReplacement(theme, cls.prefix, cls.value, round);
      if (!all && !r) continue;
      const { line, col } = lineColOf(lineStarts, cls.index);
      hits.push({
        file: path.relative(cwd, file),
        line,
        col,
        cls: cls.full,
        prefix: cls.prefix,
        value: cls.value,
        replacement: r ? r.replacement : null,
        approx: r ? r.approx : false,
      });
    }
  }

  return {
    hits,
    additions,
    spacingBasePx: theme.spacingBase.px,
    fileCount: files.length,
    patterns,
  };
};
