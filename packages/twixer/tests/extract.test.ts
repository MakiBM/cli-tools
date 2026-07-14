import { describe, expect, it } from "vitest";
import { extractArbitraryClasses } from "../src/scan.js";

describe("extractArbitraryClasses", () => {
  it("finds utility-[value] classes", () => {
    const found = extractArbitraryClasses('class="p-[16px] text-[13px]"');
    expect(found.map((f) => [f.prefix, f.value])).toEqual([
      ["p", "16px"],
      ["text", "13px"],
    ]);
  });

  it("ignores arbitrary variant selectors ending in ]:", () => {
    const found = extractArbitraryClasses("data-[state=open]:flex group-data-[x]/n:block");
    expect(found).toHaveLength(0);
  });

  it("captures values containing calc()", () => {
    const found = extractArbitraryClasses("top-[calc(100%-1rem)]");
    expect(found).toHaveLength(1);
    expect(found[0].prefix).toBe("top");
    expect(found[0].value).toBe("calc(100%-1rem)");
  });

  it("reports the match index", () => {
    const found = extractArbitraryClasses("  p-[16px]");
    expect(found[0].index).toBe(2);
  });
});
