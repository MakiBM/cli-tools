---
"@makibm/gites": patch
---

Link `.claude` into a new worktree instead of copying it. `.claude` is its own git repo, so
every copy became an independent clone that drifted from the main checkout and re-committed the
same notes under new hashes, which turned each pull into a merge conflict.
