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
  /**
   * Floor for the cut-gutter size (px). The effective gutter scales with the
   * region: `clamp(gapScale * span, minGap, maxGap)`, so a big region needs a
   * wide gutter (less noise) while a small one accepts a thin one (splits tight
   * neighbors like two adjacent photos).
   */
  minGap: number;
  /** Ceiling for the scaled cut gutter (px). */
  maxGap: number;
  /** Cut gutter as a fraction of the region's extent along the cut axis. */
  gapScale: number;
  /** Regions smaller than this in both dimensions are never split further. */
  minSize: number;
  /** Per-channel tolerance for treating a pixel as the region's background. */
  tolerance: number;
  /**
   * A row/column counts as a gutter when its ink is at most this fraction of its
   * length. Non-zero so a sparse element crossing an otherwise-empty gutter (a
   * header label in a wide margin, a thin divider) does not block the cut.
   */
  noise: number;
}

export const DEFAULT_SLICE_OPTIONS: SliceOptions = {
  minGap: 16,
  maxGap: 40,
  // Off by default: a constant 16px gutter gives clean section-level slices.
  // Raise it (e.g. 0.02) to scale the gutter with region size and split finer,
  // catching tight neighbors at the cost of more granular (line-level) regions.
  gapScale: 0,
  minSize: 24,
  tolerance: 45,
  noise: 0.03,
};

interface Region {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Rgb {
  r: number;
  g: number;
  b: number;
}

/**
 * Background color of a region: the mode of a 4-bit/channel histogram, but the
 * winning bucket is the one whose 3x3x3 neighborhood holds the most pixels, and
 * the color returned is that neighborhood's mean. Merging neighboring buckets
 * keeps a noisy/gradient background (e.g. near-black shading into dark brown)
 * from fragmenting across buckets and being mistaken for content. Deriving it
 * per region is what lets the slicer descend through nested backgrounds: the
 * page's cluster is the page background, a card's cluster is the card's.
 */
const regionBackground = (data: Uint8Array, width: number, r: Region): Rgb => {
  const count = new Int32Array(4096);
  const sr = new Float64Array(4096);
  const sg = new Float64Array(4096);
  const sb = new Float64Array(4096);
  for (let y = r.y0; y < r.y1; y++) {
    const base = y * width;
    for (let x = r.x0; x < r.x1; x++) {
      const i = (base + x) * 4;
      if (data[i + 3] < 8) continue;
      const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
      count[key]++;
      sr[key] += data[i];
      sg[key] += data[i + 1];
      sb[key] += data[i + 2];
    }
  }

  const neighbors = (key: number): number[] => {
    const qr = (key >> 8) & 0xf;
    const qg = (key >> 4) & 0xf;
    const qb = key & 0xf;
    const out: number[] = [];
    for (let dr = -1; dr <= 1; dr++) {
      for (let dg = -1; dg <= 1; dg++) {
        for (let db = -1; db <= 1; db++) {
          const nr = qr + dr;
          const ng = qg + dg;
          const nb = qb + db;
          if (nr >= 0 && nr < 16 && ng >= 0 && ng < 16 && nb >= 0 && nb < 16) {
            out.push((nr << 8) | (ng << 4) | nb);
          }
        }
      }
    }
    return out;
  };

  let bestKey = 0;
  let bestMass = -1;
  for (let key = 0; key < 4096; key++) {
    if (count[key] === 0) continue;
    let mass = 0;
    for (const nb of neighbors(key)) mass += count[nb];
    if (mass > bestMass) {
      bestMass = mass;
      bestKey = key;
    }
  }

  let cr = 0;
  let cg = 0;
  let cb = 0;
  let cn = 0;
  for (const nb of neighbors(bestKey)) {
    cr += sr[nb];
    cg += sg[nb];
    cb += sb[nb];
    cn += count[nb];
  }
  return { r: Math.round(cr / cn), g: Math.round(cg / cn), b: Math.round(cb / cn) };
};

const isInk = (data: Uint8Array, i: number, bg: Rgb, tol: number): boolean =>
  data[i + 3] >= 8 &&
  (Math.abs(data[i] - bg.r) > tol ||
    Math.abs(data[i + 1] - bg.g) > tol ||
    Math.abs(data[i + 2] - bg.b) > tol);

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

const firstNonZero = (p: number[]): number => p.findIndex((v) => v > 0);
const lastNonZero = (p: number[]): number => {
  for (let i = p.length - 1; i >= 0; i--) if (p[i] > 0) return i;
  return -1;
};

const cut = (
  data: Uint8Array,
  width: number,
  region: Region,
  opts: SliceOptions,
  isContent: boolean,
): LayoutNode | null => {
  const bg = regionBackground(data, width, region);
  const rw = region.x1 - region.x0;
  const rh = region.y1 - region.y0;

  const rowInk = Array.from<number>({ length: rh }).fill(0);
  const colInk = Array.from<number>({ length: rw }).fill(0);
  for (let y = 0; y < rh; y++) {
    const rowBase = (region.y0 + y) * width;
    for (let x = 0; x < rw; x++) {
      if (isInk(data, (rowBase + region.x0 + x) * 4, bg, opts.tolerance)) {
        rowInk[y]++;
        colInk[x]++;
      }
    }
  }

  const rowFloor = Math.floor(opts.noise * rw);
  const colFloor = Math.floor(opts.noise * rh);
  const rows = rowInk.map((v) => (v > rowFloor ? 1 : 0));
  const cols = colInk.map((v) => (v > colFloor ? 1 : 0));

  const top = firstNonZero(rows);
  const left = firstNonZero(cols);
  // No ink against this region's own background: either a solid content block the
  // parent already isolated (keep it whole) or genuine empty background (drop it).
  if (top === -1 || left === -1) {
    return isContent ? { x: region.x0, y: region.y0, width: rw, height: rh, children: [] } : null;
  }
  const bottom = lastNonZero(rows);
  const right = lastNonZero(cols);

  const box: Box = {
    x: region.x0 + left,
    y: region.y0 + top,
    width: right - left + 1,
    height: bottom - top + 1,
  };
  if (box.width < opts.minSize && box.height < opts.minSize) return { ...box, children: [] };

  const rowSpan = rows.slice(top, bottom + 1);
  const colSpan = cols.slice(left, right + 1);
  const horizontal = widestGap(rowSpan) >= widestGap(colSpan);
  const profile = horizontal ? rowSpan : colSpan;
  const effGap = Math.min(
    opts.maxGap,
    Math.max(opts.minGap, Math.round(opts.gapScale * profile.length)),
  );
  const segments = segmentsFromProfile(profile, effGap);
  if (segments.length < 2) return { ...box, children: [] };

  const children: LayoutNode[] = [];
  for (const [start, end] of segments) {
    const sub: Region = horizontal
      ? { x0: box.x, y0: box.y + start, x1: box.x + box.width, y1: box.y + end }
      : { x0: box.x + start, y0: box.y, x1: box.x + end, y1: box.y + box.height };
    const child = cut(data, width, sub, opts, true);
    if (child) children.push(child);
  }
  return children.length < 2 ? { ...box, children: [] } : { ...box, children };
};

/**
 * Recursive XY-cut over an RGBA raster. Each region derives its own background
 * from its dominant color, so it descends through nested backgrounds (page ->
 * card -> section). Returns the layout tree, or null when the region has no
 * content. Fully deterministic for a given raster.
 */
export const sliceLayout = (
  data: Uint8Array,
  width: number,
  height: number,
  opts: SliceOptions = DEFAULT_SLICE_OPTIONS,
): LayoutNode | null => cut(data, width, { x0: 0, y0: 0, x1: width, y1: height }, opts, false);

/** Flatten a layout tree to its leaf boxes in reading order (top-down, left-right). */
export const leaves = (node: LayoutNode | null): Box[] => {
  if (!node) return [];
  if (node.children.length === 0) {
    const { x, y, width, height } = node;
    return [{ x, y, width, height }];
  }
  return node.children.flatMap(leaves);
};
