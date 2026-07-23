import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import sharp from "sharp";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { layt, NotImageError } from "../src/layt.js";

let dir: string;

const W = 200;
const H = 200;

/** White canvas with two black blocks separated by a wide horizontal gutter. */
const canvas = (): Buffer => {
  const data = Buffer.alloc(W * H * 3, 255);
  const black = (x0: number, y0: number, w: number, h: number): void => {
    for (let y = y0; y < y0 + h; y++) {
      for (let x = x0; x < x0 + w; x++) {
        const i = (y * W + x) * 3;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  };
  black(20, 10, 100, 30);
  black(20, 120, 100, 30);
  return data;
};

const writeImage = async (file: string): Promise<string> => {
  const dest = path.join(dir, file);
  await sharp(canvas(), { raw: { width: W, height: H, channels: 3 } }).toFile(dest);
  return dest;
};

beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), "layt-"));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe("layt", () => {
  it("detects two regions and writes crops + manifest", async () => {
    const input = await writeImage("shot.png");
    const result = await layt({ input, out: path.join(dir, "out"), name: "shot" });

    expect(result.slices).toHaveLength(2);
    expect(result.background).toBe("#ffffff");
    for (const slice of result.slices) {
      expect(fs.existsSync(path.join(result.outDir, slice.file))).toBe(true);
    }
    expect(fs.existsSync(result.manifestPath!)).toBe(true);
    const manifest = JSON.parse(fs.readFileSync(result.manifestPath!, "utf8"));
    expect(manifest.count).toBe(2);
  });

  it.each(["shot.png", "shot.webp", "shot.gif", "shot.tiff"])(
    "decodes %s and finds the same layout",
    async (name) => {
      const input = await writeImage(name);
      const result = await layt({ input, out: path.join(dir, "out"), write: false });
      expect(result.slices).toHaveLength(2);
    },
  );

  it("decodes a lossy jpeg", async () => {
    const input = await writeImage("shot.jpg");
    const result = await layt({ input, write: false });
    expect(result.slices.length).toBeGreaterThanOrEqual(2);
  });

  it("writes nothing when write is false", async () => {
    const input = await writeImage("shot.png");
    const out = path.join(dir, "none");
    const result = await layt({ input, out, write: false });

    expect(result.written).toHaveLength(0);
    expect(result.manifestPath).toBeNull();
    expect(fs.existsSync(out)).toBe(false);
  });

  it("skips crops but keeps the manifest with --no-crops", async () => {
    const input = await writeImage("shot.png");
    const result = await layt({ input, out: path.join(dir, "out"), crops: false });

    expect(result.written).toHaveLength(1);
    expect(result.written[0]).toBe(result.manifestPath);
  });

  it("rejects an unsupported format", async () => {
    const txt = path.join(dir, "note.txt");
    fs.writeFileSync(txt, "hi");
    await expect(layt({ input: txt })).rejects.toBeInstanceOf(NotImageError);
  });

  it("rejects a missing file", async () => {
    await expect(layt({ input: path.join(dir, "nope.png") })).rejects.toBeInstanceOf(NotImageError);
  });
});
