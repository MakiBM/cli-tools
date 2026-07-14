# twixer

Find Tailwind v4 arbitrary-value classes - the `text-[13px]`, `bg-[#ef4444]`, `top-[calc(100%-1rem)]` magic-number escape hatches - across your codebase, and **see which ones can be swapped for a token from your `@theme`**.

By default the tool only shows arbitrary classes whose value matches a real token (built-in or custom), so the suggestion is exact and safe:

```
text-[14px]            ->  text-sm
bg-[#ef4444]           ->  bg-red-500
p-[16px]               ->  p-4
rounded-[2px]          ->  rounded-xs
min-w-[8rem]           ->  min-w-32
bg-[var(--brand)]      ->  bg-brand          (your @theme token)
```

With `--round` it also suggests the **nearest** token in orange when no exact match exists, e.g. `text-[11px] ~> text-xs`.

## How tokens are resolved

All theme values are read at runtime - nothing is hardcoded:

1. **Framework defaults** are read from your project's installed `tailwindcss/theme.css` (v4). oklch colors are converted to sRGB hex for matching.
2. **Your overrides** in any `*.css` under the search root (Tailwind v4 `@theme { … }` / `:root { … }`) are loaded on top.
3. **Dynamic utilities** (`ring-N`, `border-N`, `z-N`, `order-N`, `duration-N`, `p-N`, `m-N`, etc.) are computed from Tailwind's scaling rules and your `--spacing` base - not from a lookup table.

If `tailwindcss` isn't installed in `node_modules`, the tool exits with an error.

## Usage

```bash
# Scan a directory (recursively, default extensions)
npx @makibm/twixer ./src

# Or with explicit globs
npx @makibm/twixer "src/**/*.{ts,tsx,jsx,vue,svelte,html}"

# Default in cwd
npx @makibm/twixer

# Show every arbitrary class, even ones with no replacement
npx @makibm/twixer --all

# Also suggest the nearest token (orange ~>) when no exact match exists
npx @makibm/twixer --round

# Group by class instead of by file
npx @makibm/twixer --group

# Just print counts, sorted desc
npx @makibm/twixer --counts-only

# Machine-readable (includes the suggested replacement per hit)
npx @makibm/twixer --json > report.json

# Custom ignores (repeatable, on top of the defaults)
npx @makibm/twixer --ignore "**/packages/{ui,dev-toolbar}/**"

# Disable .gitignore handling (it's honored by default)
npx @makibm/twixer --no-gitignore

# Inspect every theme token that was loaded (framework + your CSS)
npx @makibm/twixer --show-theme

# Point at an extra CSS file (repeatable). Disable user-CSS scanning entirely with --no-theme.
npx @makibm/twixer --theme ./packages/tailwind-config/theme.css
```

## What it matches

- `text-[13px]`, `bg-[#1da1f2]`, `w-[42rem]`, `bg-[var(--brand)]`
- Variants: `md:hover:translate-x-[-2px]`
- Important: `!pb-[270px]`
- Negative: `-mt-[3px]`
- CSS function calls: `top-[calc(100%-1rem)]`, `bg-[url(...)]`
- Tailwind named groups/peers: `group-data-[viewport=false]/navigation-menu:...`

Arbitrary **variants** (`data-[state=open]:`, `aria-[…]:`, `group-data-[…]:`, etc.) are correctly skipped - they're selectors, not utility classes.

## Value normalization

Equivalent forms collapse to the same key before lookup, so:

- `rem`/`em` are treated as `px` at a 16px root (`1rem` == `16px`)
- `s` is treated as `ms` (`0.3s` == `300ms`)
- `#fff` and `#FFFFFF` normalize to `#ffffff`
- `oklch(63.7% 0.237 25.331)` (from v4 theme) → `#ef4444`
- `white`, `black`, `transparent`, `currentColor`, `inherit` map to their named tokens

## What it ignores

- Defaults: `node_modules`, `.git`, `dist`, `build`, `.next`, `out`, `coverage`, `.turbo`, `.cache`.
- `.gitignore` files (walking up to the nearest `.git` repo root). Disable with `--no-gitignore`.
- Extra `--ignore <glob>` patterns.

## Caveats

It's a regex-based scanner, not a parser. It looks at text only - so it will find arbitrary classes in comments and strings too. That's almost always what you want for an audit. False positives are rare in practice but possible.

## Requirements

- Node.js ≥ 16
- A project with `tailwindcss` (v4) installed in `node_modules`.

## License

MIT
