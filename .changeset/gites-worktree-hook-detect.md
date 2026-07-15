---
"@makibm/gites": patch
---

Fix first-time setup wrongly triggering inside a linked worktree: hook detection
used `--git-dir` (the per-worktree dir) instead of the shared common dir where
git actually runs hooks, so `gites` treated an already-set-up repo as new.
