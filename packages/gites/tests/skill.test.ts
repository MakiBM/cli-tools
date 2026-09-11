import { test } from "vitest";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { skillMarkdown, installSkill } from "../src/skill.js";
import { RULES } from "../src/messages.js";

test("the skill carries every rule gites enforces and installs where asked", () => {
  const md = skillMarkdown();
  for (const rule of RULES) assert.ok(md.includes(rule.title), rule.title);
  assert.match(md, /^---\nname: gites\n/);

  const dir = mkdtempSync(join(tmpdir(), "gites-skill-"));
  const path = installSkill(dir);
  assert.equal(readFileSync(path, "utf8"), md);
});
