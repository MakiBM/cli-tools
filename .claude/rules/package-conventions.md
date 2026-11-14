---
paths:
  - "**/packages/**"
---

# Package conventions (all tools)

Packages: `cli-kit` (`@makibm/cli-kit`, shared CLI shell, published), `gites` (two-track git workflow), `twixer` (Tailwind arbitrary-class finder), `hideai` (AI-trailer commit blocker), `layt` (image layout slicer). Each leaf tool depends on `"@makibm/cli-kit": "workspace:^"`.

- ESM only (`"type": "module"`, NodeNext). Relative imports end in `.js` (`./y.js`); Node builtins use the `node:` prefix.
- Everything visual comes from cli-kit: `renderLogo`, `palette`/`accent`/`dim`/`bold`, `formatHelp`, `menu`/`checkbox`/`input`/`confirm`/`search`, `Spinner`. Never re-implement banners or color escapes in a tool.
- Each tool: `--help` = logo + `formatHelp`; no-arg run = interactive menu from cli-kit prompts.
- Text: English, ASCII `-` instead of em dash, no decorative emoji. Formatter style is double quotes (`pnpm format`).
- Deep-module shape (twixer, layt): pure core plus one seam function that returns a result with no console or exit. Tests go through the seam; CLI and TUI only render the result.
- Build: each package runs `tsc -p tsconfig.build.json` (sets `rootDir`, excludes tests). `tsconfig.json` extends `../../tsconfig.base.json` and includes `tests/`. `declaration: true` only in cli-kit. `pnpm build` builds cli-kit first, because the others import it.
