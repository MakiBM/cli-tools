---
paths:
  - "**/packages/twixer/**"
  - "**/packages/layt/**"
---

# twixer and layt internals

- twixer: pure `matching.ts`, a new theme per scan (`createTheme()`), and the seam `scan(options)`. Test through `scan()`. Keep new logic out of `cli.ts` and `tui.ts`.
- layt: pure `slice.ts` (recursive XY-cut over an ink mask, no I/O); `image.ts` (sharp decode, mask, crop; png/jpg/webp/gif/avif/tiff/svg); async seam `layt(options)` that reads, slices, writes and returns a result. Test through `slice()` and `layt()`. TUI path completion uses cli-kit's `search` re-export.
- sharp ships prebuilt libvips binaries. Its ignored install script (pnpm warning) is fine: do not add sharp to `onlyBuiltDependencies`.
