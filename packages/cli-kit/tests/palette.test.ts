import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { accent, bold, colorsEnabled, dim, palette } from "../src/index.js";

describe("palette", () => {
  const savedEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...savedEnv };
  });

  describe("with color disabled (NO_COLOR)", () => {
    beforeEach(() => {
      delete process.env.FORCE_COLOR;
      process.env.NO_COLOR = "1";
    });

    it("colorsEnabled is false", () => {
      expect(colorsEnabled()).toBe(false);
    });

    it("accent/dim/bold return the raw string", () => {
      expect(accent("x")).toBe("x");
      expect(dim("x")).toBe("x");
      expect(bold("x")).toBe("x");
    });
  });

  describe("with color forced", () => {
    beforeEach(() => {
      delete process.env.NO_COLOR;
      process.env.FORCE_COLOR = "1";
    });

    it("colorsEnabled is true", () => {
      expect(colorsEnabled()).toBe(true);
    });

    it("accent wraps text in a truecolor escape and resets", () => {
      const out = accent("x");
      expect(out).toContain("38;2;166;226;46");
      expect(out).toContain("x");
      expect(out).toContain("\x1b[39m");
    });

    it("accent accepts a custom rgb color", () => {
      expect(accent("x", [1, 2, 3])).toContain("38;2;1;2;3");
    });
  });

  it("exposes a named lime accent in the palette", () => {
    expect(palette.lime).toEqual([166, 226, 46]);
  });
});
