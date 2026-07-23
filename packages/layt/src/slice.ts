export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface LayoutNode extends Box {
  children: LayoutNode[];
}

export interface SliceOptions {
  /** Minimum run of empty rows/columns (in px) that counts as a cut gutter. */
  minGap: number;
  /** Regions smaller than this in both dimensions are never split further. */
  minSize: number;
}

export const DEFAULT_SLICE_OPTIONS: SliceOptions = { minGap: 16, minSize: 24 };

interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

const isInk = (mask: Uint8Array, width: number, x: number, y: number): boolean =>
  mask[y * width + x] === 1;

/** Shrink a region to the tight bounding box of its ink, or null if empty. */
const shrinkToInk = (mask: Uint8Array, width: number, r: Region): Region | null => {
  let minX = r.x1;
  let minY = r.y1;
  let maxX = r.x0 - 1;
  let maxY = r.y0 - 1;
  for (let y = r.y0; y < r.y1; y++) {
    for (let x = r.x0; x < r.x1; x++) {
      if (!isInk(mask, width, x, y)) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }
  if (maxX < minX || maxY < minY) return null;
  return { x0: minX, y0: minY, x1: maxX + 1, y1: maxY + 1 };
};

/** Content ranges [start, end) between gutters of >= minGap empty cells in a profile. */
const segmentsFromProfile = (profile: number[], minGap: number): Array<[number, number]> => {
  const segments: Array<[number, number]> = [];
  let start = -1;
  let gap = 0;
  for (let i = 0; i < profile.length; i++) {
    if (profile[i] > 0) {
      if (start === -1) start = i;
      gap = 0;
    } else if (start !== -1) {
      gap++;
      if (gap >= minGap) {
        segments.push([start, i - gap + 1]);
        start = -1;
        gap = 0;
      }
    }
  }
  if (start !== -1) segments.push([start, profile.length - gap]);
  return segments;
};

/** Widest gutter (run of empty cells) strictly inside a trimmed profile. */
const widestGap = (profile: number[]): number => {
  let widest = 0;
  let gap = 0;
  for (const value of profile) {
    if (value === 0) {
      gap++;
      if (gap > widest) widest = gap;
    } else {
      gap = 0;
    }
  }
  return widest;
};

const cut = (
  mask: Uint8Array,
  width: number,
  region: Region,
  opts: SliceOptions,
): LayoutNode | null => {
  const trimmed = shrinkToInk(mask, width, region);
  if (!trimmed) return null;

  const w = trimmed.x1 - trimmed.x0;
  const h = trimmed.y1 - trimmed.y0;
  const box: Box = { x: trimmed.x0, y: trimmed.y0, width: w, height: h };

  if (w < opts.minSize && h < opts.minSize) return { ...box, children: [] };

  const rowProfile = Array.from<number>({ length: h }).fill(0);
  const colProfile = Array.from<number>({ length: w }).fill(0);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (isInk(mask, width, trimmed.x0 + x, trimmed.y0 + y)) {
        rowProfile[y]++;
        colProfile[x]++;
      }
    }
  }

  const rowGap = widestGap(rowProfile);
  const colGap = widestGap(colProfile);
  const horizontal = rowGap >= colGap;
  const profile = horizontal ? rowProfile : colProfile;
  const segments = segmentsFromProfile(profile, opts.minGap);

  if (segments.length < 2) return { ...box, children: [] };

  const children: LayoutNode[] = [];
  for (const [start, end] of segments) {
    const sub: Region = horizontal
      ? { x0: trimmed.x0, y0: trimmed.y0 + start, x1: trimmed.x1, y1: trimmed.y0 + end }
      : { x0: trimmed.x0 + start, y0: trimmed.y0, x1: trimmed.x0 + end, y1: trimmed.y1 };
    const child = cut(mask, width, sub, opts);
    if (child) children.push(child);
  }
  return { ...box, children };
};

/**
 * Recursive XY-cut over a binary ink mask. Returns the layout tree, or null
 * when the mask has no ink at all. Fully deterministic for a given mask.
 */
export const sliceLayout = (
  mask: Uint8Array,
  width: number,
  height: number,
  opts: SliceOptions = DEFAULT_SLICE_OPTIONS,
): LayoutNode | null => cut(mask, width, { x0: 0, y0: 0, x1: width, y1: height }, opts);

/** Flatten a layout tree to its leaf boxes in reading order (top-down, left-right). */
export const leaves = (node: LayoutNode | null): Box[] => {
  if (!node) return [];
  if (node.children.length === 0) {
    const { x, y, width, height } = node;
    return [{ x, y, width, height }];
  }
  return node.children.flatMap(leaves);
};
