# makibm-tools

Monorepo of MakiBM command-line tools, all built on a shared CLI shell
([`@makibm/cli-kit`](packages/cli-kit)) - consistent logo (with a "By MakiBM"
line and subtitle), color palette, help formatting, and interactive menus.

## Packages

| Package                               | Command  | What it does                                                                              |
| ------------------------------------- | -------- | ----------------------------------------------------------------------------------------- |
| [`@makibm/cli-kit`](packages/cli-kit) | -        | Published toolkit: `renderLogo`, `palette`, `formatHelp`, menu/prompt helpers, `spinner`. |
| [`@makibm/gites`](packages/gites)     | `gites`  | Two-track git workflow for batching and timing client commits.                            |
| [`@makibm/twixer`](packages/twixer)   | `twixer` | Find Tailwind v4 arbitrary-value classes and suggest the matching default token.          |
| [`@makibm/hideai`](packages/hideai)   | `hideai` | Block commits with AI-assistant trailers (Claude, Copilot, Cursor, …).                    |

## Develop

```bash
pnpm install        # link the workspace
pnpm build          # build every package (cli-kit first)
pnpm test           # run all Vitest suites
pnpm test:coverage  # with coverage
pnpm lint           # oxlint
pnpm format         # oxfmt (write); pnpm format:check to verify
pnpm typecheck      # tsc --noEmit per package
```

Run a tool during development:

```bash
pnpm --filter @makibm/gites dev
pnpm --filter @makibm/twixer dev
pnpm --filter @makibm/hideai dev
```

## Link the commands globally

pnpm needs its global bin directory on `PATH` once:

```bash
pnpm setup                                    # adds PNPM_HOME to your shell profile
exec $SHELL                                   # reload the shell
pnpm --filter @makibm/gites --filter @makibm/twixer --filter @makibm/hideai \
  exec pnpm link --global                     # expose gites / twixer / hideai
```

## Stack

pnpm workspaces · TypeScript (ESM, NodeNext) · Vitest · oxlint + oxfmt.

By MakiBM
