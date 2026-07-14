# CLAUDE.md - cli-tools monorepo

pnpm-workspaces monorepo of MakiBM CLI tools. Read this before editing.

## Layout

- `packages/cli-kit` - `@makibm/cli-kit`, the shared CLI shell (published). Logo,
  palette, help formatter, menu/prompt helpers, spinner. See its README.
- `packages/gites` - `@makibm/gites` (bin `gites`), two-track git workflow.
- `packages/twixer` - `@makibm/twixer` (bin `twixer`), Tailwind arbitrary-class finder.
- `packages/hideai` - `@makibm/hideai` (bin `hideai`), AI-trailer commit blocker.

Leaf tools depend on cli-kit via `"@makibm/cli-kit": "workspace:^"`.

## Conventions

- **ESM only** (`"type": "module"`, NodeNext). Relative imports MUST end in `.js`
  (e.g. `import { x } from "./y.js"`); prefix Node builtins with `node:`.
- **Use cli-kit for anything visual** - `renderLogo`, `palette`/`accent`/`dim`/`bold`,
  `formatHelp`, `menu`/`checkbox`/`input`/`confirm`, `Spinner`. Do not re-implement
  banners or color escapes in a tool. Each tool's `--help` is a logo + `formatHelp`;
  its no-arg entry is an interactive menu built from cli-kit prompts.
- **Style**: English only. No em dash `—` (use ASCII `-`). No decorative emoji.
  Prefer self-documenting code; comments say what code does, not what changed.
- **Each package builds** with `tsc -p tsconfig.build.json`. `tsconfig.json` extends
  `../../tsconfig.base.json` and includes `tests/`; `tsconfig.build.json` sets
  `rootDir` and excludes tests. `declaration: true` only in cli-kit.

## Commands (from repo root)

```bash
pnpm install            # link workspace
pnpm build              # tsc all packages (cli-kit first - others import it)
pnpm test               # vitest run (all)
pnpm test:coverage
pnpm lint               # oxlint
pnpm format             # oxfmt --write   (run before committing; double-quote style)
pnpm format:check
pnpm typecheck
```

Filter one package: `pnpm --filter @makibm/twixer <script>`.

## Gotchas

- **cli-kit logo font is preloaded** from `packages/cli-kit/src/font-ansi-shadow.ts`
  via `figlet.parseFont`. Do NOT switch to figlet's own font loading - its ESM build
  reads the font path against CWD and crashes at runtime. Don't reformat that vendored
  file (it's in `.oxfmtrc.json` ignore, along with test fixtures).
- **gites tests are git-heavy** (spawn sandboxes, `chdir`): 30s timeout in
  `packages/gites/vitest.config.ts`, and Vitest isolates files so cwd is per-file.
  In `workflow.test.ts`, fresh-module dynamic imports use a dotless nonce query -
  a dot in the query makes Vite misread it as a file extension.
- **twixer** is a deep-module refactor: pure `matching.ts`, per-scan `createTheme()`,
  and a reusable `scan(options)` seam (no console/exit). Test through `scan()`; the
  CLI/TUI just render its result. Keep new logic out of `cli.ts`/`tui.ts`.

## Runtime identifiers (don't confuse tools)

- gites: git config `gites.*`, branch prefix `gites-<name>`, env `GITES_VERBOSE`,
  hook marker `# gites pre-push hook`, backup `.pre-gites`.
- hideai: git config `hideai.block` (CSV), hook marker `hideai commit-msg hook`.

## Releasing

Bump version, `pnpm build`, then publish (cli-kit first): `pnpm -r publish --access public`.
`@makibm` is a free npm **org** (not a personal scope) - you must be a member to
publish. GitHub repo is `MakiBM/cli-tools`. Full remote steps in `RELEASE.md`.
