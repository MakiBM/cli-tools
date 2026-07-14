import * as path from 'node:path';
import type { Hit, ScanResult } from './scan.js';

export interface RenderOptions {
  color: boolean;
  group?: boolean;
  countsOnly?: boolean;
}

const makeColors = (useColor: boolean) => {
  const c = (code: string, s: string): string => (useColor ? `\x1b[${code}m${s}\x1b[0m` : s);
  return {
    dim: (s: string) => c('2', s),
    bold: (s: string) => c('1', s),
    cyan: (s: string) => c('36', s),
    yellow: (s: string) => c('33', s),
    green: (s: string) => c('32', s),
    red: (s: string) => c('31', s),
    orange: (s: string) => (useColor ? `\x1b[38;5;208m${s}\x1b[0m` : s),
  };
};

type Palette = ReturnType<typeof makeColors>;

const fmtRep = (
  p: Palette,
  rep: string | null | undefined,
  approx: boolean | undefined,
): string => {
  if (!rep) return '';
  const sep = approx ? p.dim('~>') : p.dim('->');
  const color = approx ? p.orange : p.green;
  return `  ${sep}  ${color(rep)}`;
};

/** Render scan hits as human-readable text (or JSON via renderJson). */
export const renderHits = (result: ScanResult, options: RenderOptions): string => {
  const p = makeColors(options.color);
  const { hits } = result;

  if (!hits.length) return p.green('No arbitrary-value classes found. 🎉');

  const repByCls = new Map<string, { rep: string | null; approx: boolean }>();
  for (const h of hits) repByCls.set(h.cls, { rep: h.replacement, approx: h.approx });

  const lines: string[] = [];

  if (options.countsOnly) {
    const counts = new Map<string, number>();
    for (const h of hits) counts.set(h.cls, (counts.get(h.cls) ?? 0) + 1);
    for (const [cls, n] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
      const entry = repByCls.get(cls);
      lines.push(`${String(n).padStart(5)}  ${p.yellow(cls)}${fmtRep(p, entry?.rep, entry?.approx)}`);
    }
    return lines.join('\n');
  }

  if (options.group) {
    const byClass = new Map<string, Hit[]>();
    for (const h of hits) {
      if (!byClass.has(h.cls)) byClass.set(h.cls, []);
      byClass.get(h.cls)!.push(h);
    }
    for (const [cls, occ] of [...byClass.entries()].sort((a, b) => b[1].length - a[1].length)) {
      const entry = repByCls.get(cls);
      lines.push(
        `${p.bold(p.yellow(cls))} ${p.dim(`(${occ.length})`)}${fmtRep(p, entry?.rep, entry?.approx)}`,
      );
      for (const h of occ) lines.push(`  ${p.cyan(h.file)}${p.dim(':')}${h.line}${p.dim(':')}${h.col}`);
      lines.push('');
    }
  } else {
    const byFile = new Map<string, Hit[]>();
    for (const h of hits) {
      if (!byFile.has(h.file)) byFile.set(h.file, []);
      byFile.get(h.file)!.push(h);
    }
    for (const [file, hs] of byFile) {
      lines.push(p.bold(p.cyan(file)) + p.dim(` (${hs.length})`));
      for (const h of hs) {
        lines.push(
          `  ${p.dim(`${h.line}:${h.col}`.padEnd(8))}${p.yellow(h.cls)}${fmtRep(p, h.replacement, h.approx)}`,
        );
      }
      lines.push('');
    }
  }

  const uniqueClasses = new Set(hits.map((h) => h.cls)).size;
  const uniqueFiles = new Set(hits.map((h) => h.file)).size;
  lines.push(
    p.bold(
      `${hits.length} occurrence${hits.length === 1 ? '' : 's'} · ` +
        `${uniqueClasses} unique class${uniqueClasses === 1 ? '' : 'es'} · ` +
        `${uniqueFiles} file${uniqueFiles === 1 ? '' : 's'}`,
    ),
  );
  return lines.join('\n');
};

export const renderJson = (result: ScanResult): string =>
  JSON.stringify({ count: result.hits.length, hits: result.hits }, null, 2);

/** Render the loaded theme tokens (for --show-theme). */
export const renderTheme = (result: ScanResult, useColor: boolean, cwd: string): string => {
  const p = makeColors(useColor);
  if (!result.additions.length) return p.dim('No theme tokens loaded.');
  const bySource = new Map<string, typeof result.additions>();
  for (const a of result.additions) {
    if (!bySource.has(a.source)) bySource.set(a.source, []);
    bySource.get(a.source)!.push(a);
  }
  const lines: string[] = [];
  for (const [src, items] of bySource) {
    lines.push(p.bold(p.cyan(path.relative(cwd, src))) + p.dim(` (${items.length})`));
    for (const a of items) lines.push(`  ${p.dim(a.ns + '-')}${p.yellow(a.name)} ${p.dim('=')} ${a.rawValue}`);
  }
  lines.push(p.dim(`\nspacing base: ${result.spacingBasePx}px · ${result.additions.length} tokens`));
  return lines.join('\n');
};
