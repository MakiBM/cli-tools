import { describe, expect, it } from "vitest";
import { type Box, leaves, sliceLayout } from "../src/slice.js";

const W = 200;
const H = 200;

/** White RGBA canvas with black blocks painted in. */
const canvasWith = (rects: Box[]): Uint8Array => {
  const data = new Uint8Array(W * H * 4).fill(255);
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.height; y++) {
      for (let x = r.x; x < r.x + r.width; x++) {
        const i = (y * W + x) * 4;
        data[i] = data[i + 1] = data[i + 2] = 0;
      }
    }
  }
  return data;
};

const boxes = (rects: Box[]): Box[] => leaves(sliceLayout(canvasWith(rects), W, H));

describe("sliceLayout", () => {
  it("returns null for a blank canvas", () => {
    expect(sliceLayout(new Uint8Array(W * H * 4).fill(255), W, H)).toBeNull();
  });

  it("tightly bounds a single block", () => {
    expect(boxes([{ x: 30, y: 40, width: 50, height: 60 }])).toEqual([
      { x: 30, y: 40, width: 50, height: 60 },
    ]);
  });

  it("splits two vertically stacked blocks", () => {
    const result = boxes([
      { x: 20, y: 10, width: 100, height: 30 },
      { x: 20, y: 90, width: 100, height: 30 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].y).toBe(10);
    expect(result[1].y).toBe(90);
  });

  it("splits two side-by-side blocks", () => {
    const result = boxes([
      { x: 10, y: 20, width: 30, height: 100 },
      { x: 120, y: 20, width: 30, height: 100 },
    ]);
    expect(result).toHaveLength(2);
    expect(result[0].x).toBe(10);
    expect(result[1].x).toBe(120);
  });

  it("recurses into a grid of blocks", () => {
    const result = boxes([
      { x: 10, y: 10, width: 30, height: 30 },
      { x: 120, y: 10, width: 30, height: 30 },
      { x: 10, y: 120, width: 30, height: 30 },
      { x: 120, y: 120, width: 30, height: 30 },
    ]);
    expect(result).toHaveLength(4);
  });

  it("keeps a block whole when gaps are below minGap", () => {
    const result = leaves(
      sliceLayout(
        canvasWith([
          { x: 20, y: 10, width: 100, height: 30 },
          { x: 20, y: 45, width: 100, height: 30 },
        ]),
        W,
        H,
        { minGap: 20, maxGap: 40, gapScale: 0.02, minSize: 24, tolerance: 12, noise: 0.03 },
      ),
    );
    expect(result).toHaveLength(1);
  });

  it("isolates two cards sitting on a differently colored page", () => {
    const data = new Uint8Array(W * H * 4).fill(255);
    for (let i = 0; i < data.length; i += 4) {
      data[i] = data[i + 1] = data[i + 2] = 0; // black page
    }
    const card = (x0: number, y0: number, w: number, h: number): void => {
      for (let y = y0; y < y0 + h; y++) {
        for (let x = x0; x < x0 + w; x++) {
          const i = (y * W + x) * 4;
          data[i] = data[i + 1] = data[i + 2] = 230; // cream
        }
      }
    };
    card(20, 20, 160, 60);
    card(20, 130, 160, 50);

    const result = leaves(sliceLayout(data, W, H));
    expect(result).toHaveLength(2);
    expect(result[0].y).toBe(20);
    expect(result[1].y).toBe(130);
  });
});
