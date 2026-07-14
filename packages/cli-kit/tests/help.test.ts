import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { formatHelp } from '../src/index.js';

describe('formatHelp', () => {
  const savedEnv = { ...process.env };
  beforeEach(() => {
    delete process.env.FORCE_COLOR;
    process.env.NO_COLOR = '1';
  });
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  it('renders the usage line', () => {
    const out = formatHelp({ usage: 'gites [command]' });
    expect(out).toContain('gites [command]');
    expect(out.toLowerCase()).toContain('usage');
  });

  it('lists commands with their summaries', () => {
    const out = formatHelp({
      usage: 'gites [command]',
      commands: [{ name: 'ship', summary: 'ship commits' }],
    });
    expect(out).toContain('ship');
    expect(out).toContain('ship commits');
  });

  it('lists options with their summaries', () => {
    const out = formatHelp({
      usage: 'gites [command]',
      options: [{ flag: '-v, --verbose', summary: 'show git output' }],
    });
    expect(out).toContain('--verbose');
    expect(out).toContain('show git output');
  });

  it('aligns command names in a column', () => {
    const out = formatHelp({
      usage: 'x',
      commands: [
        { name: 'a', summary: 'short' },
        { name: 'longer-name', summary: 'other' },
      ],
    });
    const lines = out.split('\n').filter((l) => l.includes('short') || l.includes('other'));
    const shortIdx = lines.find((l) => l.includes('short'))!.indexOf('short');
    const otherIdx = lines.find((l) => l.includes('other'))!.indexOf('other');
    expect(shortIdx).toBe(otherIdx);
  });
});
