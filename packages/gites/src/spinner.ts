import pc from 'picocolors';
import { accent } from './colors.js';

const FRAMES = [
  '░░░░░░',
  '░░░░░░',
  '░░░░░░',
  '░░░░░░',
  '▓░░░░░',
  '▒▓░░░░',
  '░▒▓░░░',
  '░░▒▓░░',
  '░░░▒▓░',
  '░░░░▒▓',
  '░░░░░▒',
];
const INTERVAL = 100;

export class Spinner {
  private label: string;
  private i = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly enabled: boolean;

  constructor(label = 'Working...') {
    this.label = label;
    this.enabled = Boolean(process.stdout.isTTY) && !process.env.GITPACE_VERBOSE;
  }

  start(): void {
    if (!this.enabled) return;
    process.stdout.write('\x1b[?25l');
    this.render();
    this.timer = setInterval(() => this.render(), INTERVAL);
  }

  private render(): void {
    const frame = FRAMES[this.i % FRAMES.length]!;
    process.stdout.write(`\r\x1b[2K${accent(frame)} ${this.label}`);
    this.i++;
  }

  stop(finalLine?: string): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    if (this.enabled) {
      process.stdout.write('\r\x1b[2K');
      process.stdout.write('\x1b[?25h');
    }
    if (finalLine !== undefined) console.log(finalLine);
  }
}

export async function withSpinner<T>(
  label: string,
  fn: () => Promise<T>,
  successLine?: string,
): Promise<T> {
  const s = new Spinner(label);
  s.start();
  try {
    const result = await fn();
    s.stop(successLine ?? `${pc.green('✔')} ${label}`);
    return result;
  } catch (e) {
    s.stop(pc.red(`✗ ${label}`));
    throw e;
  }
}
