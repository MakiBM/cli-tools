import { bold, dim, formatHelp, renderLogo } from "@makibm/cli-kit";
import { layt, NotImageError } from "./layt.js";
import { SUBTITLE } from "./meta.js";
import { renderJson, renderResult } from "./render.js";
import { runTui } from "./tui.js";

const ABOUT = [
  "Layt cuts an image into layout regions purely by the whitespace between blocks,",
  "with no ML and no guessing. It reads png/jpg/webp/gif/avif/tiff/svg and runs a",
  "recursive XY-cut (projection profiles + valley detection), so the same image",
  "always yields the same boxes. It reports each region as x,y,width,height and,",
  "by default, writes a PNG crop per region plus a <name>.layt.json manifest.",
  "It sees blocks separated by background, not buttons or headings.",
].join("\n");

const HELP = {
  usage: "layt <image> [options]",
  options: [
    { flag: "-o, --out <dir>", summary: "Output directory (default: ./<name>-layt)" },
    {
      flag: "-n, --name <base>",
      summary: "Base filename for slices + manifest (default: image name)",
    },
    { flag: "--min-gap <px>", summary: "Min whitespace gutter that counts as a cut (default 16)" },
    {
      flag: "--min-size <px>",
      summary: "Regions smaller than this are not split further (default 24)",
    },
    { flag: "--threshold <n>", summary: "Per-channel ink threshold, 0-255 (default 12)" },
    { flag: "--bg <auto|#hex>", summary: "Background color (default auto = dominant color)" },
    { flag: "--json", summary: "Print the layout as JSON to stdout, write no files (for agents)" },
    { flag: "--no-crops", summary: "Write only the manifest, skip the slice crops" },
    { flag: "--no-color", summary: "Disable ANSI colors" },
    { flag: "-h, --help", summary: "Show this help" },
  ],
};

const valueOf = (argv: string[], ...names: string[]): string | undefined => {
  for (const name of names) {
    const i = argv.indexOf(name);
    if (i !== -1 && argv[i + 1]) return argv[i + 1];
  }
  return undefined;
};

const numberOf = (argv: string[], name: string): number | undefined => {
  const raw = valueOf(argv, name);
  if (raw === undefined) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) ? n : undefined;
};

const FLAGS_WITH_VALUE = new Set([
  "-o",
  "--out",
  "-n",
  "--name",
  "--min-gap",
  "--min-size",
  "--threshold",
  "--bg",
]);

export async function run(argv: string[]): Promise<void> {
  if (argv.length === 0) {
    await runTui();
    return;
  }

  const flags = new Set(argv.filter((a) => a.startsWith("-")));

  if (flags.has("--help") || flags.has("-h")) {
    console.log(renderLogo("LAYT", { subtitle: SUBTITLE }));
    console.log("");
    console.log(`${bold("About:")}\n${dim(ABOUT)}`);
    console.log("");
    console.log(formatHelp(HELP));
    return;
  }

  const positional = argv.filter(
    (a, i) => !a.startsWith("-") && !FLAGS_WITH_VALUE.has(argv[i - 1]),
  );
  const input = positional[0];
  if (!input) {
    console.error("Error: no image given. Usage: layt <image> [options]");
    process.exitCode = 1;
    return;
  }

  const color = !flags.has("--no-color") && Boolean(process.stdout.isTTY);
  const json = flags.has("--json");

  try {
    const result = await layt({
      input,
      out: valueOf(argv, "-o", "--out"),
      name: valueOf(argv, "-n", "--name"),
      minGap: numberOf(argv, "--min-gap"),
      minSize: numberOf(argv, "--min-size"),
      threshold: numberOf(argv, "--threshold"),
      bg: valueOf(argv, "--bg"),
      crops: !flags.has("--no-crops"),
      write: !json,
    });

    if (json) {
      process.stdout.write(renderJson(result) + "\n");
      return;
    }
    console.log(renderResult(result, color));
  } catch (error) {
    if (error instanceof NotImageError) {
      console.error(`Error: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }
}
