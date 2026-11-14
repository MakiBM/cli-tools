---
name: verify
description: Use before you commit a change in the cli-tools monorepo: install, build, test, lint, format and type-check from the repo root.
---

# Verify a change (repo root)

1. `pnpm install` (links the workspace).
2. `pnpm build` (tsc in all packages, cli-kit first).
3. `pnpm test` (vitest run, all). Coverage: `pnpm test:coverage`.
4. `pnpm lint` (oxlint).
5. `pnpm format` (oxfmt --write), always before a commit; `pnpm format:check` to only check.
6. `pnpm typecheck`.

One package only: `pnpm --filter @makibm/<tool> <script>`.
After gites test timeouts, clean stray sandboxes (rule `gites-tests`).
