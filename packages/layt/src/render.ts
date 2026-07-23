import { accent, bold, dim } from "@makibm/cli-kit";
import type { LaytResult } from "./layt.js";

export const renderJson = (result: LaytResult): string =>
  JSON.stringify(
    {
      source: result.source,
      width: result.width,
      height: result.height,
      background: result.background,
      count: result.slices.length,
      slices: result.slices,
      tree: result.tree,
    },
    null,
    2,
  );

export const renderResult = (result: LaytResult, color: boolean): string => {
  const b = color ? bold : (s: string) => s;
  const a = color ? accent : (s: string) => s;
  const d = color ? dim : (s: string) => s;

  const lines: string[] = [];
  lines.push(
    `${b(result.name)}  ${d(`${result.width}x${result.height}`)}  ${d("bg " + result.background)}`,
  );
  lines.push(`${a(String(result.slices.length))} regions`);
  for (const s of result.slices) {
    lines.push(
      `  ${d(String(s.index).padStart(3, "0"))}  ${s.x},${s.y}  ${s.width}x${s.height}  ${d(s.file)}`,
    );
  }
  if (result.written.length) {
    lines.push("");
    lines.push(d(`wrote ${result.written.length} files to ${result.outDir}`));
  }
  return lines.join("\n");
};
