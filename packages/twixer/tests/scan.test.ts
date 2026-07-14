import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { scan, type Hit } from '../src/scan.js';

const themeCss = fileURLToPath(new URL('./fixtures/theme.css', import.meta.url));
const projectDir = fileURLToPath(new URL('./fixtures/project', import.meta.url));

const run = (extra = {}) =>
  scan({
    patterns: [projectDir],
    tailwindThemeCss: themeCss,
    useUserTheme: false,
    useGitignore: false,
    ...extra,
  });

const byClass = (hits: Hit[]) => new Map(hits.map((h) => [h.cls, h]));

describe('scan', () => {
  it('resolves exact matches against theme + dynamic rules', () => {
    const hits = byClass(run().hits);
    expect(hits.get('p-[16px]')?.replacement).toBe('p-4');
    expect(hits.get('bg-[#ff0000]')?.replacement).toBe('bg-red-500');
    expect(hits.get('rounded-[8px]')?.replacement).toBe('rounded-lg');
    expect(hits.get('text-[14px]')?.replacement).toBe('text-sm');
    expect(hits.get('z-[10]')?.replacement).toBe('z-10');
  });

  it('expands shorthand hex before matching', () => {
    expect(byClass(run().hits).get('bg-[#f00]')?.replacement).toBe('bg-red-500');
  });

  it('never reports arbitrary variant selectors', () => {
    const classes = run({ all: true }).hits.map((h) => h.cls);
    expect(classes.some((c) => c.includes('data-['))).toBe(false);
  });

  it('omits non-matching classes unless round or all is set', () => {
    expect(byClass(run().hits).has('text-[13px]')).toBe(false);
  });

  it('suggests the nearest token as an approximate match with round', () => {
    const hit = byClass(run({ round: true }).hits).get('text-[13px]');
    expect(hit?.replacement).toBe('text-sm');
    expect(hit?.approx).toBe(true);
  });

  it('includes unmatched classes with all, marked as no replacement', () => {
    const hit = byClass(run({ all: true }).hits).get('text-[13px]');
    expect(hit).toBeDefined();
    expect(hit?.replacement).toBeNull();
  });

  it('builds a fresh theme per call (no cross-call leakage)', () => {
    const first = run();
    const second = run();
    expect(second.hits.length).toBe(first.hits.length);
  });

  it('reports the spacing base from --spacing', () => {
    expect(run().spacingBasePx).toBe(4);
  });
});
