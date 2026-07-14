# @makibm/cli-kit

The shared CLI shell behind the MakiBM tools ([gites](../gites),
[twixer](../twixer), [hideai](../hideai)). It gives every tool the same look:
a generated block-letter logo with a "By MakiBM" line and subtitle, a color
palette, a consistent help formatter, interactive-menu helpers, and a spinner.

```bash
npm install @makibm/cli-kit
```

ESM only, Node >= 20.

## Quick start

```ts
import { renderLogo, formatHelp, menu, palette } from "@makibm/cli-kit";

console.log(renderLogo("MYTOOL", { subtitle: "Does a useful thing." }));

console.log(
  formatHelp({
    usage: "mytool [command]",
    commands: [{ name: "run", summary: "Run the thing" }],
    options: [{ flag: "-h, --help", summary: "Show help" }],
  }),
);

const choice = await menu({
  message: "What now?",
  choices: [
    { name: "Run", value: "run" },
    { name: "Quit", value: "quit" },
  ],
});
```

## API

### Logo

`renderLogo(text, options?) => string`

Generates block-letter ASCII from `text` (figlet "ANSI Shadow", font bundled -
no runtime file reads) and frames it with a by-line and optional subtitle.

| option     | type     | default             | notes                                          |
| ---------- | -------- | ------------------- | ---------------------------------------------- |
| `by`       | `string` | `"MakiBM"`          | dimmed attribution line under the logo         |
| `subtitle` | `string` | -                   | printed (after a blank line) below the by-line |
| `accent`   | `Rgb`    | lime `[166,226,46]` | color of the block art                         |

```ts
renderLogo("GITES", { subtitle: "Two-track git workflow.", accent: palette.green });
```

`printBanner(text, options?) => void` - convenience wrapper that `console.log`s
the logo with blank lines around it (same options as `renderLogo`).

### Palette & colors

All helpers no-op when color is disabled (honors `NO_COLOR`, `FORCE_COLOR`, and
whether stdout is a TTY).

```ts
import { accent, dim, bold, green, red, palette, colorsEnabled, ACCENT_RGB } from "@makibm/cli-kit";

accent("highlighted"); // lime by default
accent("custom", [255, 0, 0]); // any Rgb tuple
dim("subtle");
bold("strong");
green("ok");
red("fail");
colorsEnabled(); // boolean
palette; // { lime, white, red, green, yellow }
```

`type Rgb = readonly [number, number, number]`.

> Note: `bold` and `dim` both reset with the same ANSI code (`22`), so avoid
> nesting them (`bold(dim(x))`) - the inner reset clears both.

### Help formatter

`formatHelp({ usage, commands?, options? }) => string`

Renders a consistent, column-aligned help screen. `commands` is
`{ name, summary }[]`, `options` is `{ flag, summary }[]`.

```ts
formatHelp({
  usage: "twixer [glob|dir...] [options]",
  options: [
    { flag: "--json", summary: "Machine-readable output" },
    { flag: "-h, --help", summary: "Show this help" },
  ],
});
```

Pair it with the logo for a full `--help` screen:

```ts
console.log(renderLogo("TWIXER", { subtitle: SUBTITLE }));
console.log("");
console.log(formatHelp(HELP));
```

### Interactive menus & prompts

Thin, re-exported wrappers over [`@inquirer/prompts`](https://github.com/SBoudrias/Inquirer.js):
`select`, `checkbox`, `input`, `confirm`, plus a `menu` convenience.

```ts
import { menu, checkbox, input, confirm } from "@makibm/cli-kit";

const action = await menu({
  message: "Pick one",
  choices: [
    { name: "Scan", value: "scan" },
    { name: "Quit", value: "quit" },
  ],
});

const opts = await checkbox({
  message: "Options",
  choices: [{ name: "Verbose", value: "v" }],
});

const path = await input({ message: "Path:", default: "." });
const ok = await confirm({ message: "Continue?", default: true });
```

`menu<T>({ message, choices })` where `choices: { name, value, description? }[]`
returns the chosen `value`.

### Spinner

```ts
import { Spinner, withSpinner } from "@makibm/cli-kit";

await withSpinner("Fetching", async () => doWork()); // auto ✔/✗ line

const s = new Spinner("Working", { enabled: process.stdout.isTTY });
s.start();
try {
  await doWork();
  s.stop("done");
} catch (e) {
  s.stop("failed");
  throw e;
}
```

`new Spinner(label?, { enabled? })` - `enabled` defaults to whether stdout is a
TTY; pass `false` to force it off (e.g. under a `--verbose` mode).

## Build a CLI with it

A minimal tool that shows a banner, handles `--help`, and otherwise runs a menu:

```ts
#!/usr/bin/env node
import { renderLogo, formatHelp, menu } from "@makibm/cli-kit";

const HELP = formatHelp({
  usage: "mytool [command]",
  commands: [{ name: "run", summary: "Run the thing" }],
  options: [{ flag: "-h, --help", summary: "Show help" }],
});

async function main(argv: string[]) {
  if (argv.includes("-h") || argv.includes("--help")) {
    console.log(renderLogo("MYTOOL", { subtitle: "Does a useful thing." }));
    console.log("\n" + HELP);
    return;
  }
  const action = await menu({
    message: "What now?",
    choices: [
      { name: "Run", value: "run" },
      { name: "Quit", value: "quit" },
    ],
  });
  if (action === "run") console.log("running...");
}

main(process.argv.slice(2)).catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
```

See [gites](../gites/src), [twixer](../twixer/src), and [hideai](../hideai/src)
for real usage (logo + `formatHelp` for `--help`, cli-kit prompts for their TUIs).
