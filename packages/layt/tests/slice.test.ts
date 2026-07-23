import { describe, expect, it } from "vitest";
import { type Box, leaves, sliceLayout } from "../src/slice.js";

const W = 200;
const H = 200;

const maskWith = (rects: Box[]): Uint8Array => {
  const mask = new Uint8Array(W * H);
  for (const r of rects) {
    for (let y = r.y; y < r.y + r.height; y++) {
      for (let x = r.x; x < r.x + r.width; x++) mask[y * W + x] = 1;
    }
  }
  return mask;
};

const boxes = (rects: Box[]): Box[] => leaves(sliceLayout(maskWith(rects), W, H));

describe("sliceLayout", () => {
  it("returns null for an empty mask", () => {
    expect(sliceLayout(new Uint8Array(W * H), W, H)).toBeNull();
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
        maskWith([
          { x: 20, y: 10, width: 100, height: 30 },
          { x: 20, y: 45, width: 100, height: 30 },
        ]),
        W,
        H,
        { minGap: 20, minSize: 24 },
      ),
    );
    expect(result).toHaveLength(1);
  });
});
