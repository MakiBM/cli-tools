---
paths:
  - "**/packages/gites/**"
---

# gites tests

- The tests spawn git sandboxes and `chdir`. `vitest.config.ts` sets a 30 s timeout and `maxWorkers: 3`: more workers raise git latency under load past the timeout. Vitest isolates files, so cwd is per file.
- `inDir` never returns to the real checkout after a sandbox: a test that timed out keeps running, and its git calls must not reach this repo.
- After a run with timeouts, look for stray sandboxes: `git branch` and `git config --local -l` for `gites.*` or `test-*` leftovers.
- In `workflow.test.ts`, fresh-module dynamic imports use a nonce query without a dot: a dot makes Vite read it as a file extension.
