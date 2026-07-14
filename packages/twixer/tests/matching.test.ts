import { describe, expect, it } from 'vitest';
import { expandHex, normalizeValue, splitPrefix } from '../src/matching.js';

describe('normalizeValue', () => {
  it('expands 3-digit hex to 6-digit', () => {
    expect(normalizeValue('#f00')).toBe('#ff0000');
  });

  it('lowercases and keeps 6-digit hex', () => {
    expect(normalizeValue('#FF0000')).toBe('#ff0000');
  });

  it('converts rem to px at 16px base', () => {
    expect(normalizeValue('1rem')).toBe('16px');
    expect(normalizeValue('0.5rem')).toBe('8px');
  });

  it('keeps px as-is', () => {
    expect(normalizeValue('16px')).toBe('16px');
    expect(normalizeValue('13px')).toBe('13px');
  });

  it('converts seconds to milliseconds', () => {
    expect(normalizeValue('1.5s')).toBe('1500ms');
  });

  it('maps color keywords', () => {
    expect(normalizeValue('white')).toBe('#ffffff');
    expect(normalizeValue('black')).toBe('#000000');
  });

  it('converts oklch to hex', () => {
    expect(normalizeValue('oklch(0% 0 0)')).toBe('#000000');
  });
});

describe('expandHex', () => {
  it('doubles each nibble for shorthand hex', () => {
    expect(expandHex('abc')).toBe('#aabbcc');
  });
});

describe('splitPrefix', () => {
  it('separates variants, bang and negative', () => {
    expect(splitPrefix('hover:!-mt')).toEqual({
      variants: 'hover:',
      bang: '!',
      neg: '-',
      bare: 'mt',
    });
  });

  it('handles a bare utility', () => {
    expect(splitPrefix('p')).toEqual({ variants: '', bang: '', neg: '', bare: 'p' });
  });
});
