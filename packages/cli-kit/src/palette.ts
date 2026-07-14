export type Rgb = readonly [number, number, number];

export const palette = {
  lime: [166, 226, 46] as Rgb,
  white: [255, 255, 255] as Rgb,
  red: [235, 77, 75] as Rgb,
  green: [111, 207, 151] as Rgb,
  yellow: [246, 229, 141] as Rgb,
} as const;

export const ACCENT_RGB: Rgb = palette.lime;

/** Whether ANSI color should be emitted, honoring NO_COLOR / FORCE_COLOR / TTY. */
export function colorsEnabled(): boolean {
  if (process.env.NO_COLOR) return false;
  if (process.env.FORCE_COLOR) return true;
  return Boolean(process.stdout.isTTY);
}

function wrap(text: string, open: string, close: string): string {
  return colorsEnabled() ? `${open}${text}${close}` : text;
}

/** Color text with a truecolor foreground (defaults to the lime accent). */
export function accent(text: string, color: Rgb = ACCENT_RGB): string {
  const [r, g, b] = color;
  return wrap(text, `\x1b[38;2;${r};${g};${b}m`, '\x1b[39m');
}

export function dim(text: string): string {
  return wrap(text, '\x1b[2m', '\x1b[22m');
}

export function bold(text: string): string {
  return wrap(text, '\x1b[1m', '\x1b[22m');
}

export function green(text: string): string {
  return accent(text, palette.green);
}

export function red(text: string): string {
  return accent(text, palette.red);
}
