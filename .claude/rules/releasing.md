---
paths:
  - "**/.changeset/**"
  - "**/.github/workflows/**"
  - "**/package.json"
  - "**/CHANGELOG.md"
  - "**/RELEASE.md"
---

# Releasing (Changesets)

- Every shippable change carries a changeset, committed with the work (skill `release-change`).
- Never hand-bump `version` fields or edit changelogs: `changeset version` does it in the "Version Packages" PR.
- `.github/workflows/release.yml` on push to `main`: opens or updates the "Version Packages" PR; merging it publishes to npm.
- `@makibm` is a free npm organization, not a personal scope. CI publishes with the `NPM_TOKEN` repo secret. Repo: `MakiBM/cli-tools`. Maintainer steps: `RELEASE.md`.
