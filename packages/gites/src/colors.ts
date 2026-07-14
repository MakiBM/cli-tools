const ACCENT_RGB: readonly [number, number, number] = [166, 226, 46];

function supportsColor(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
}

const ENABLED = supportsColor();

export function accent(text: string): string {
  if (!ENABLED) return text;
  const [r, g, b] = ACCENT_RGB;
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}
