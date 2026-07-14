import { describe, expect, it } from 'vitest';
import { formatBlockList, parseBlockList } from '../src/blocklist.js';

describe('parseBlockList', () => {
  it('splits a CSV into keys', () => {
    expect(parseBlockList('claude,copilot,cursor')).toEqual(['claude', 'copilot', 'cursor']);
  });

  it('trims whitespace and drops empties', () => {
    expect(parseBlockList(' claude , , copilot ')).toEqual(['claude', 'copilot']);
  });

  it('returns an empty array for an empty value', () => {
    expect(parseBlockList('')).toEqual([]);
  });
});

describe('formatBlockList', () => {
  it('joins keys with commas', () => {
    expect(formatBlockList(['claude', 'copilot'])).toBe('claude,copilot');
  });

  it('round-trips with parseBlockList', () => {
    const keys = ['claude', 'cursor', 'gemini'];
    expect(parseBlockList(formatBlockList(keys))).toEqual(keys);
  });
});
