---
name: release-change
description: Use when a change in a cli-tools package should ship to npm: add the changeset that the release workflow turns into a version bump.
---

# Ship a change

1. `pnpm changeset`: pick the packages, the bump type (patch, minor, major) and write a summary.
2. Commit the new `.changeset/*.md` file with the work.
3. Push to `main`. The release workflow opens or updates the "Version Packages" PR.
4. Merging that PR publishes the bumped packages to npm.
