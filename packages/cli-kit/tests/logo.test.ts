import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { renderLogo } from '../src/index.js';

const ANSI = /\[/;

describe('renderLogo', () => {
  const savedEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.FORCE_COLOR;
    process.env.NO_COLOR = '1';
  });

  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('renders block-letter art for the given text', () => {
    const out = renderLogo('GITES');
    expect(out).toContain('█');
    // ANSI Shadow uses box-drawing chars in the block glyphs
    expect(out).toContain('╗');
  });

  it('includes the "By MakiBM" line by default', () => {
    expect(renderLogo('GITES')).toContain('By MakiBM');
  });

  it('honors a custom by-line', () => {
    expect(renderLogo('GITES', { by: 'Someone' })).toContain('By Someone');
  });

  it('includes the subtitle when provided', () => {
    const out = renderLogo('GITES', { subtitle: 'a nice tagline' });
    expect(out).toContain('a nice tagline');
  });

  it('omits subtitle text when not provided', () => {
    const out = renderLogo('GITES');
    expect(out).not.toContain('undefined');
  });

  it('emits no ANSI escapes when color is disabled', () => {
    const out = renderLogo('GITES', { subtitle: 'sub' });
    expect(ANSI.test(out)).toBe(false);
  });

  it('emits ANSI escapes when color is forced', () => {
    delete process.env.NO_COLOR;
    process.env.FORCE_COLOR = '1';
    const out = renderLogo('GITES');
    expect(ANSI.test(out)).toBe(true);
  });
});
