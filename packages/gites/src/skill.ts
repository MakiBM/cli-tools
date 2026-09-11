import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { RULES } from "./messages.js";

export function skillMarkdown(): string {
  const rules = RULES.map((r) => `## ${r.title}\n\n${r.body}`).join("\n\n");
  return `---
name: gites
description: Rules for repos managed by gites (two-track git workflow, gitpace-/gites- work branches, live client branches, stacked features, PR lock). Read before any git operation in such a repo, before resolving conflicts, and before shipping.
---

# gites

A feature is two branches: \`gites-<name>\` (private work branch, pushed only to the backup remote) and \`<name>\` (live client branch on origin, filled by \`gites ship\` with paced timestamps). The work prefix may be \`gitpace-\` in older repos (\`git config gites.workprefix\`).

Commands: \`gites start-feature <name> [base] --worktree\`, \`gites ship [--yes]\`, \`gites change-base\`, \`gites resync\`, \`gites unlock <name>\`, \`gites cleanup\`. \`gites start-feature --print-path\` prints only the worktree path.

${rules}

## Recovery

- Merged the base into work by mistake: \`git rebase --onto <name> <mergeCommit> gites-<name>\`.
- Botched ship: \`git branch -f <name> origin/<name>\`, then \`git checkout -f gites-<name>\`.
`;
}

export function skillDir(): string {
  return process.env.GITES_SKILL_DIR || join(homedir(), ".claude", "skills", "gites");
}

export function installSkill(dir: string = skillDir()): string {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, "SKILL.md");
  writeFileSync(path, skillMarkdown());
  return path;
}
