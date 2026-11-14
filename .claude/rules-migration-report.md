# Rules migration report

- `CLAUDE.md` (project file, also the only agent note; it has no note list, so it was left as it was plus the knowledge line):
  - Layout, ESM imports, cli-kit for visuals, text style, deep-module shape, build and tsconfig: `.claude/rules/package-conventions.md`
  - cli-kit font preload and vendored font file: `.claude/rules/cli-kit.md`
  - gites git-heavy tests, sandbox leftovers, dotless nonce query: `.claude/rules/gites-tests.md`
  - Runtime identifiers of gites and hideai: `.claude/rules/git-tool-identifiers.md`
  - twixer and layt internals, sharp install script: `.claude/rules/twixer-layt.md`
  - Releasing with Changesets, npm org, token: `.claude/rules/releasing.md`, procedure `.claude/skills/release-change/SKILL.md`
  - Commands from the repo root: `.claude/skills/verify/SKILL.md`
- Left out on purpose:
  - `RELEASE.md`: maintainer steps (one-time GitHub and npm setup, archive of old repos); human docs, only referenced from `releasing.md`.
  - `docs/superpowers/specs/2026-09-11-agent-workflow-design.md` and `docs/superpowers/plans/2026-09-11-agent-workflow.md`: a finished design and its implementation plan (history, most parts live outside this repo), not standing agent notes.
  - Package READMEs: product docs.
- Open: `CLAUDE.md` still holds the same knowledge as the rules (not edited, by instruction). Trimming it to the knowledge line would remove the duplicate.
