import * as fs from "node:fs";
import * as path from "node:path";
import { cropPng, decodeImage, isSupported, resolveBackground, toHex } from "./image.js";
import { type Box, DEFAULT_SLICE_OPTIONS, type LayoutNode, leaves, sliceLayout } from "./slice.js";

export interface LaytOptions {
  /** Path to the source image (png/jpg/webp/gif/avif/tiff/svg). */
  input: string;
  /** Output directory (default: ./<name>-layt). */
  out?: string;
  /** Base filename for slices and manifest (default: input basename). */
  name?: string;
  minGap?: number;
  maxGap?: number;
  gapScale?: number;
  minSize?: number;
  /** Per-channel tolerance for background detection, 0-255 (default 45). */
  tolerance?: number;
  /** Gutter noise floor as a fraction of line length, 0-1 (default 0.03). */
  noise?: number;
  /** Background color: "auto" or a hex like "#ffffff" (default "auto"). */
  bg?: string;
  /** Skip writing slice crops; only detect boxes (and manifest, if writing). */
  crops?: boolean;
  /** When false, detect only and write nothing to disk. */
  write?: boolean;
}

export interface SliceEntry extends Box {
  index: number;
  file: string;
}

export interface LaytResult {
  source: string;
  width: number;
  height: number;
  background: string;
  outDir: string;
  name: string;
  slices: SliceEntry[];
  tree: LayoutNode | null;
  manifestPath: string | null;
  written: string[];
}

const pad = (n: number): string => String(n).padStart(3, "0");

export class NotImageError extends Error {}

/**
 * Detect the layout of an image by recursive XY-cut and (optionally) write the
 * region crops plus a JSON manifest. Pure seam: no console output, no exit.
 */
export const layt = async (options: LaytOptions): Promise<LaytResult> => {
  const input = path.resolve(options.input);
  if (!fs.existsSync(input)) throw new NotImageError(`file not found: ${options.input}`);
  if (!isSupported(input)) {
    throw new NotImageError(`unsupported image format: ${options.input}`);
  }

  const base = options.name?.trim() || path.basename(input, path.extname(input));
  const outDir = path.resolve(options.out?.trim() || ".layt");
  const write = options.write !== false;
  const withCrops = options.crops !== false;

  const raster = await decodeImage(input);
  const bg = resolveBackground(raster, options.bg ?? "auto");

  const tree = sliceLayout(raster.data, raster.width, raster.height, {
    minGap: options.minGap ?? DEFAULT_SLICE_OPTIONS.minGap,
    maxGap: options.maxGap ?? DEFAULT_SLICE_OPTIONS.maxGap,
    gapScale: options.gapScale ?? DEFAULT_SLICE_OPTIONS.gapScale,
    minSize: options.minSize ?? DEFAULT_SLICE_OPTIONS.minSize,
    tolerance: options.tolerance ?? DEFAULT_SLICE_OPTIONS.tolerance,
    noise: options.noise ?? DEFAULT_SLICE_OPTIONS.noise,
  });

  const written: string[] = [];
  const slices: SliceEntry[] = leaves(tree)
    .filter((box) => box.width >= 4 && box.height >= 4)
    .map((box, i) => {
      const index = i + 1;
      const file = `${base}-${pad(index)}.png`;
      return { index, file, ...box };
    });

  let manifestPath: string | null = null;
  if (write) {
    fs.mkdirSync(outDir, { recursive: true });
    if (withCrops) {
      for (const slice of slices) {
        const dest = path.join(outDir, slice.file);
        fs.writeFileSync(dest, await cropPng(raster, slice));
        written.push(dest);
      }
    }
    manifestPath = path.join(outDir, `${base}.layt.json`);
    fs.writeFileSync(manifestPath, JSON.stringify(buildManifest(), null, 2) + "\n");
    written.push(manifestPath);
  }

  function buildManifest() {
    return {
      source: input,
      width: raster.width,
      height: raster.height,
      background: toHex(bg),
      count: slices.length,
      slices: slices.map((s) => ({
        index: s.index,
        file: withCrops ? s.file : null,
        x: s.x,
        y: s.y,
        width: s.width,
        height: s.height,
      })),
      tree,
    };
  }

  return {
    source: input,
    width: raster.width,
    height: raster.height,
    background: toHex(bg),
    outDir,
    name: base,
    slices,
    tree,
    manifestPath,
    written,
  };
};
