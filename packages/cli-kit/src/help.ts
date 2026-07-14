import { accent, bold, dim } from "./palette.js";

export interface HelpCommand {
  name: string;
  summary: string;
}

export interface HelpOption {
  flag: string;
  summary: string;
}

export interface HelpSpec {
  usage: string;
  commands?: HelpCommand[];
  options?: HelpOption[];
}

function section(title: string, rows: Array<[string, string]>): string[] {
  if (rows.length === 0) return [];
  const width = Math.max(...rows.map(([left]) => left.length));
  const lines = [bold(title)];
  for (const [left, right] of rows) {
    lines.push(`  ${accent(left.padEnd(width))}  ${dim(right)}`);
  }
  lines.push("");
  return lines;
}

/** Render a consistent help screen from a usage line, commands and options. */
export function formatHelp(spec: HelpSpec): string {
  const lines: string[] = [bold("Usage:"), `  ${spec.usage}`, ""];
  lines.push(
    ...section(
      "Commands:",
      (spec.commands ?? []).map((c) => [c.name, c.summary] as [string, string]),
    ),
  );
  lines.push(
    ...section(
      "Options:",
      (spec.options ?? []).map((o) => [o.flag, o.summary] as [string, string]),
    ),
  );
  return lines.join("\n").replace(/\n+$/, "");
}
