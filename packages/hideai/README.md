# hideai

Tiny git hook installer that blocks commit messages with AI assistant trailers
— Claude, Copilot, Cursor, ChatGPT, Aider, Tabnine, Gemini, and more.

## Install

```
npx hideai
```

Interactive checkbox: pick which agents to block. Hook is written into the
current repo's `commit-msg` hook (honoring `core.hooksPath` if set). Block
list is stored in git config `hideai.block` (CSV).

## Commands

```
hideai           Interactive setup (default)
hideai install   Same as default
hideai uninstall Remove hook and config
hideai list      Show all known agents
hideai status    Show what's blocked in this repo
```

## How it works

The installed hook is a small portable bash script. On every commit, it reads
`git config hideai.block` (e.g. `claude,copilot,cursor`) and runs case-insensitive
grep patterns against the commit message. If any match, the commit is rejected
with a message explaining which agent's pattern triggered.

Patterns are intentionally narrow — they target the literal `Co-Authored-By:`
trailers and "Generated with ..." footers these tools tend to emit. They will
not flag legitimate commit messages that simply mention an agent name.

## Supported agents

`claude`, `openai`, `copilot`, `cursor`, `windsurf`, `codeium`, `aider`,
`tabnine`, `gemini`, `continue`, `devin`, `v0`, `bolt`, `lovable`, `replit`.

## Uninstall

```
hideai uninstall
```

Restores any prior hook from `<hook>.pre-hideai` backup. Clears the
`hideai.block` config.
