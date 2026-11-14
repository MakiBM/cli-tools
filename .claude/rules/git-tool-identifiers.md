---
paths:
  - "**/packages/gites/**"
  - "**/packages/hideai/**"
---

# Runtime identifiers of the git tools (do not mix them)

- gites: git config `gites.*` (work prefix in `gites.workprefix`, default `gites-`), work branches `gites-<name>`, env `GITES_VERBOSE`, hook marker `# gites pre-push hook`, backup `.pre-gites`. Legacy `gitpace.*` config and the `gitpace-` prefix are detected and migrated to `gites.*`.
- hideai: git config `hideai.block` (CSV), hook marker `hideai commit-msg hook`.
