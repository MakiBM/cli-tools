import { describe, expect, it } from "vitest";
import { AGENTS, blockingAgents, getAgent, matchesAgent } from "../src/agents.js";

const claude = getAgent("claude")!;

describe("matchesAgent", () => {
  it("blocks a Claude co-author trailer (case-insensitive)", () => {
    const msg = "fix: bug\n\nCo-Authored-By: Claude <noreply@anthropic.com>";
    expect(matchesAgent(claude, msg)).toBe(true);
  });

  it('blocks a "Generated with Claude" footer', () => {
    expect(matchesAgent(claude, "feat\n\nGenerated with Claude Code")).toBe(true);
  });

  it("does not block an ordinary human commit", () => {
    expect(
      matchesAgent(claude, "fix: correct the off-by-one\n\nCo-Authored-By: Ada <ada@x.io>"),
    ).toBe(false);
  });

  it("matches copilot trailer for the copilot agent only", () => {
    const msg = "chore\n\nCo-Authored-By: GitHub Copilot <copilot@github.com>";
    expect(matchesAgent(getAgent("copilot")!, msg)).toBe(true);
    expect(matchesAgent(claude, msg)).toBe(false);
  });

  it("respects line anchors like aider ^aider:", () => {
    expect(matchesAgent(getAgent("aider")!, "aider: refactor module")).toBe(true);
    expect(matchesAgent(getAgent("aider")!, "see aider: docs later")).toBe(false);
  });

  it("every agent pattern compiles as a valid regex", () => {
    for (const a of AGENTS) {
      expect(() => matchesAgent(a, "x")).not.toThrow();
    }
  });
});

describe("blockingAgents", () => {
  it("returns only the configured agents that match", () => {
    const msg = "feat\n\nCo-Authored-By: Cursor <cursor@x>";
    const hit = blockingAgents(msg, ["claude", "cursor", "copilot"]);
    expect(hit.map((a) => a.key)).toEqual(["cursor"]);
  });

  it("ignores unknown keys", () => {
    expect(blockingAgents("anything", ["nope"])).toEqual([]);
  });

  it("returns empty when nothing is configured", () => {
    const msg = "Co-Authored-By: Claude <noreply@anthropic.com>";
    expect(blockingAgents(msg, [])).toEqual([]);
  });
});
