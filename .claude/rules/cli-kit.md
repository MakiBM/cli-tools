---
paths:
  - "**/packages/cli-kit/**"
  - "**/.oxfmtrc.json"
---

# cli-kit

- The logo font is preloaded from `src/font-ansi-shadow.ts` with `figlet.parseFont`. Never switch to figlet's own font loading: its ESM build resolves the font path against the CWD and crashes at runtime.
- `font-ansi-shadow.ts` is vendored: never reformat it. It is in the `.oxfmtrc.json` ignore list, with `**/tests/fixtures/**`.
