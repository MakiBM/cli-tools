import { NAMESPACE_ALIASES, PREFIX_RULES, type Rule, type Table, type Theme } from './tw-defaults.js';

// ---------- oklch -> hex ----------
// Tailwind v4 theme uses oklch(). We convert to sRGB hex so values can be
// matched against authored hex arbitrary classes.
export const oklchToHex = (L: number, C: number, h: number): string => {
  const labL = L / 100;
  const a = C * Math.cos((h * Math.PI) / 180);
  const b = C * Math.sin((h * Math.PI) / 180);
  let l = labL + 0.3963377774 * a + 0.2158037573 * b;
  let m = labL - 0.1055613458 * a - 0.0638541728 * b;
  let s = labL - 0.0894841775 * a - 1.291485548 * b;
  l = l ** 3;
  m = m ** 3;
  s = s ** 3;
  const r = 4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s;
  const g = -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s;
  const bl = -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s;
  const toSrgb = (x: number): number => {
    if (!Number.isFinite(x) || x <= 0) return 0;
    if (x >= 1) return 1;
    return x <= 0.0031308 ? 12.92 * x : 1.055 * Math.pow(x, 1 / 2.4) - 0.055;
  };
  const hex = (n: number): string =>
    Math.max(0, Math.min(255, Math.round(toSrgb(n) * 255)))
      .toString(16)
      .padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(bl)}`;
};

export const parseOklch = (raw: string): string | null => {
  const m = raw.match(/^oklch\(\s*([\d.]+)%?\s+([\d.]+)\s+([\d.]+)\s*(?:\/\s*[\d.]+%?\s*)?\)$/i);
  if (!m) return null;
  return oklchToHex(parseFloat(m[1]), parseFloat(m[2]), parseFloat(m[3]));
};

// ---------- value normalization ----------
export const expandHex = (h: string): string => {
  let s = h.toLowerCase();
  if (s.length === 3) s = s.split('').map((ch) => ch + ch).join('');
  if (s.length === 4) s = s.split('').map((ch) => ch + ch).join('');
  return `#${s}`;
};

export const normalizeValue = (raw: string): string => {
  const v = raw.replace(/_/g, ' ').trim();
  const mHex = v.match(/^#([0-9a-fA-F]{3,8})$/);
  if (mHex) return expandHex(mHex[1]);
  const oklch = parseOklch(v);
  if (oklch) return oklch;
  const lower = v.toLowerCase();
  if (lower === 'white') return '#ffffff';
  if (lower === 'black') return '#000000';
  if (['transparent', 'currentcolor', 'inherit'].includes(lower)) return lower;
  const mLen = v.match(/^(-?\d*\.?\d+)(px|rem|em|%|vh|vw|ms|s)$/);
  if (mLen) {
    let n = parseFloat(mLen[1]);
    let unit = mLen[2];
    if (unit === 'rem') {
      n = n * 16;
      unit = 'px';
    }
    if (unit === 's') {
      n = n * 1000;
      unit = 'ms';
    }
    const num = Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(4)));
    return `${num}${unit}`;
  }
  return v;
};

// ---------- prefix splitting ----------
export interface PrefixParts {
  variants: string;
  bang: string;
  neg: string;
  bare: string;
}

export const splitPrefix = (prefix: string): PrefixParts => {
  const parts = prefix.split(':');
  const bareRaw = parts.pop() ?? '';
  const variants = parts.length ? parts.join(':') + ':' : '';
  let rest = bareRaw;
  let bang = '';
  let neg = '';
  if (rest.startsWith('!')) {
    bang = '!';
    rest = rest.slice(1);
  }
  if (rest.startsWith('-')) {
    neg = '-';
    rest = rest.slice(1);
  }
  return { variants, bang, neg, bare: rest };
};

// ---------- matching ----------
const NUM_UNIT_RE = /^(-?\d*\.?\d+)([a-z%]*)$/;

// Format a numeric suffix the way Tailwind writes it (drop trailing zeros,
// keep `.5` halves).
const fmtSpacingSuffix = (n: number): string =>
  Number.isInteger(n) ? String(n) : String(parseFloat(n.toFixed(3)));

export interface Replacement {
  replacement: string;
  approx: boolean;
}

const buildReplacement = (parts: PrefixParts, suffix: string): string => {
  const { variants, bang, neg, bare } = parts;
  const body = suffix === '' ? bare : `${bare}-${suffix}`;
  return `${variants}${bang}${neg}${body}`;
};

const distance = (a: string, b: string): number => {
  if (a.startsWith('#') && b.startsWith('#') && a.length === 7 && b.length === 7) {
    const rgb = (h: string): [number, number, number] => [
      parseInt(h.slice(1, 3), 16),
      parseInt(h.slice(3, 5), 16),
      parseInt(h.slice(5, 7), 16),
    ];
    const [r1, g1, b1] = rgb(a);
    const [r2, g2, b2] = rgb(b);
    return Math.sqrt((r1 - r2) ** 2 + (g1 - g2) ** 2 + (b1 - b2) ** 2);
  }
  const m1 = a.match(NUM_UNIT_RE);
  const m2 = b.match(NUM_UNIT_RE);
  if (m1 && m2 && m1[2] === m2[2]) {
    return Math.abs(parseFloat(m1[1]) - parseFloat(m2[1]));
  }
  return Infinity;
};

const acceptApprox = (value: string, dist: number): boolean => {
  if (!Number.isFinite(dist)) return false;
  if (value.startsWith('#')) return dist <= 40;
  const m = value.match(NUM_UNIT_RE);
  if (!m) return false;
  const unit = m[2];
  const n = Math.abs(parseFloat(m[1]));
  if (unit === 'px') return dist <= Math.max(4, n * 0.25);
  if (unit === 'ms') return dist <= Math.max(50, n * 0.3);
  if (unit === 'em' || unit === '%') return dist <= Math.max(0.05, n * 0.25);
  if (unit === '') return dist <= Math.max(1, n * 0.1);
  return dist <= n * 0.25;
};

// Try a single rule against a normalized value. Returns the suffix on hit.
const applyRule = (
  theme: Theme,
  rule: Rule,
  norm: string,
  bare: string,
): { suffix: string; approx: false } | null => {
  if (rule.kind === 'theme') {
    const table = theme.namespaces[rule.ns];
    let key = norm;
    if (bare === 'leading' && /^-?\d*\.?\d+$/.test(norm)) key = `${norm}x`;
    if (Object.prototype.hasOwnProperty.call(table, key)) {
      return { suffix: table[key], approx: false };
    }
    return null;
  }
  if (rule.kind === 'spacing') {
    const mPx = norm.match(/^(-?\d*\.?\d+)px$/);
    if (!mPx) return null;
    const px = parseFloat(mPx[1]);
    if (px === 0) return { suffix: '0', approx: false };
    if (px === 1) return { suffix: 'px', approx: false };
    const base = theme.spacingBase.px ?? 4;
    const n = px / base;
    // Accept whole-number or .5 multiples.
    if (Math.abs(n - Math.round(n * 2) / 2) < 1e-6) {
      return { suffix: fmtSpacingSuffix(Math.round(n * 2) / 2), approx: false };
    }
    return null;
  }
  if (rule.kind === 'integer-px') {
    const mPx = norm.match(/^(-?\d+)px$/);
    if (!mPx) return null;
    const n = parseInt(mPx[1], 10);
    return { suffix: String(n), approx: false };
  }
  if (rule.kind === 'integer') {
    if (/^-?\d+$/.test(norm)) return { suffix: norm, approx: false };
    return null;
  }
  if (rule.kind === 'ms') {
    const mMs = norm.match(/^(-?\d+)ms$/);
    if (mMs) return { suffix: mMs[1], approx: false };
    return null;
  }
  if (rule.kind === 'percent') {
    const mPct = norm.match(/^(-?\d+)%$/);
    if (mPct) return { suffix: mPct[1], approx: false };
    if (/^-?\d+$/.test(norm)) return { suffix: norm, approx: false };
    return null;
  }
  return null;
};

// Approximate-match within a single rule.
const approxRule = (
  theme: Theme,
  rule: Rule,
  norm: string,
  bare: string,
): { suffix: string; dist: number } | null => {
  if (rule.kind === 'theme') {
    const table = theme.namespaces[rule.ns];
    let key = norm;
    if (bare === 'leading' && /^-?\d*\.?\d+$/.test(norm)) key = `${norm}x`;
    let best: { suffix: string; dist: number } | null = null;
    for (const k of Object.keys(table)) {
      const d = distance(key, k);
      if (best === null || d < best.dist) best = { suffix: table[k], dist: d };
    }
    return best;
  }
  if (rule.kind === 'spacing') {
    const mPx = norm.match(/^(-?\d*\.?\d+)px$/);
    if (!mPx) return null;
    const px = parseFloat(mPx[1]);
    const base = theme.spacingBase.px ?? 4;
    const rounded = Math.round((px / base) * 2) / 2;
    const dist = Math.abs(px - rounded * base);
    return { suffix: fmtSpacingSuffix(rounded), dist };
  }
  if (rule.kind === 'integer-px') {
    const mPx = norm.match(/^(-?\d*\.?\d+)px$/);
    if (!mPx) return null;
    const n = Math.round(parseFloat(mPx[1]));
    return { suffix: String(n), dist: Math.abs(parseFloat(mPx[1]) - n) };
  }
  if (rule.kind === 'integer') {
    const m = norm.match(/^(-?\d*\.?\d+)$/);
    if (!m) return null;
    const n = Math.round(parseFloat(m[1]));
    return { suffix: String(n), dist: Math.abs(parseFloat(m[1]) - n) };
  }
  if (rule.kind === 'ms') {
    const m = norm.match(/^(-?\d*\.?\d+)ms$/);
    if (!m) return null;
    const n = Math.round(parseFloat(m[1]));
    return { suffix: String(n), dist: Math.abs(parseFloat(m[1]) - n) };
  }
  if (rule.kind === 'percent') {
    const m = norm.match(/^(-?\d*\.?\d+)%?$/);
    if (!m) return null;
    const n = Math.round(parseFloat(m[1]));
    return { suffix: String(n), dist: Math.abs(parseFloat(m[1]) - n) };
  }
  return null;
};

/** Resolve an arbitrary `prefix-[value]` to its default-token replacement, if any. */
export const lookupReplacement = (
  theme: Theme,
  prefix: string,
  value: string,
  allowApprox: boolean,
): Replacement | null => {
  const parts = splitPrefix(prefix);
  const rules = PREFIX_RULES[parts.bare];
  if (!rules) return null;
  const norm = normalizeValue(value);
  for (const rule of rules) {
    const hit = applyRule(theme, rule, norm, parts.bare);
    if (hit) return { replacement: buildReplacement(parts, hit.suffix), approx: false };
  }
  if (!allowApprox) return null;
  let best: { suffix: string; dist: number } | null = null;
  for (const rule of rules) {
    const a = approxRule(theme, rule, norm, parts.bare);
    if (a && (best === null || a.dist < best.dist)) best = a;
  }
  if (best && acceptApprox(norm, best.dist)) {
    return { replacement: buildReplacement(parts, best.suffix), approx: true };
  }
  return null;
};

export { NAMESPACE_ALIASES, type Table };
