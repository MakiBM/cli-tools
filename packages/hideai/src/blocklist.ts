/** Parse the `hideai.block` CSV git-config value into agent keys. */
export function parseBlockList(csv: string): string[] {
  if (!csv) return [];
  return csv
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Format agent keys into the CSV stored in `hideai.block`. */
export function formatBlockList(keys: readonly string[]): string {
  return keys.join(",");
}
