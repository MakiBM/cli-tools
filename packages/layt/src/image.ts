import sharp from "sharp";
import type { Box } from "./slice.js";

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export interface Raster {
  width: number;
  height: number;
  data: Buffer;
}

/** Raster web formats sharp/libvips can decode. */
export const SUPPORTED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".webp",
  ".gif",
  ".avif",
  ".tif",
  ".tiff",
  ".svg",
]);

export const isSupported = (file: string): boolean => {
  const dot = file.lastIndexOf(".");
  return dot !== -1 && SUPPORTED_EXTENSIONS.has(file.slice(dot).toLowerCase());
};

/** Decode any supported image to a flat RGBA raster (no EXIF auto-rotation). */
export const decodeImage = async (file: string): Promise<Raster> => {
  const { data, info } = await sharp(file)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { width: info.width, height: info.height, data };
};

const parseHex = (hex: string): Rgb | null => {
  const clean = hex.replace(/^#/, "");
  const expanded =
    clean.length === 3
      ? clean
          .split("")
          .map((c) => c + c)
          .join("")
      : clean;
  if (!/^[0-9a-fA-F]{6}$/.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, 2), 16),
    g: parseInt(expanded.slice(2, 4), 16),
    b: parseInt(expanded.slice(4, 6), 16),
  };
};

/** Most frequent opaque pixel color, quantized to 4 bits/channel to fight anti-aliasing noise. */
export const dominantColor = (raster: Raster): Rgb => {
  const counts = new Map<number, number>();
  const { data } = raster;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 8) continue;
    const key = ((data[i] >> 4) << 8) | ((data[i + 1] >> 4) << 4) | (data[i + 2] >> 4);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  let bestKey = 0xfff;
  let bestCount = -1;
  for (const [key, count] of counts) {
    if (count > bestCount) {
      bestCount = count;
      bestKey = key;
    }
  }
  const q = (v: number): number => (v << 4) | v;
  return { r: q((bestKey >> 8) & 0xf), g: q((bestKey >> 4) & 0xf), b: q(bestKey & 0xf) };
};

export const resolveBackground = (raster: Raster, bg: string): Rgb =>
  bg === "auto" ? dominantColor(raster) : (parseHex(bg) ?? dominantColor(raster));

export const toHex = ({ r, g, b }: Rgb): string =>
  "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

/** Crop a region straight from the decoded raster and encode it as PNG. */
export const cropPng = (raster: Raster, box: Box): Promise<Buffer> =>
  sharp(raster.data, { raw: { width: raster.width, height: raster.height, channels: 4 } })
    .extract({ left: box.x, top: box.y, width: box.width, height: box.height })
    .png()
    .toBuffer();
