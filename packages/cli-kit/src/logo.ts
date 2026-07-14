import figlet from "figlet";
import { ACCENT_RGB, accent, dim, type Rgb } from "./palette.js";
import ansiShadow from "./font-ansi-shadow.js";

const FONT = "ANSI Shadow";

// Preload the bundled font so textSync never reads from disk (figlet's ESM
// build resolves font paths against CWD and fails at runtime otherwise).
figlet.parseFont(FONT, ansiShadow);

export interface LogoOptions {
  /** Attribution line rendered under the logo. Defaults to "MakiBM". */
  by?: string;
  /** Optional tagline rendered below the by-line. */
  subtitle?: string;
  /** Accent color for the block art. Defaults to the lime accent. */
  accent?: Rgb;
}

/** Render block-letter ASCII art for `text`, framed with a by-line and optional subtitle. */
export function renderLogo(text: string, options: LogoOptions = {}): string {
  const { by = "MakiBM", subtitle, accent: accentColor = ACCENT_RGB } = options;

  const art = figlet.textSync(text, { font: FONT }).replace(/\s+$/, "");

  const lines = [accent(art, accentColor), dim(`By ${by}`)];
  if (subtitle) lines.push("", subtitle);
  return lines.join("\n");
}

/** Print the logo to stdout with surrounding spacing. */
export function printBanner(text: string, options?: LogoOptions): void {
  console.log("");
  console.log(renderLogo(text, options));
  console.log("");
}
