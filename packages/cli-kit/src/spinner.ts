import { accent, green, red } from './palette.js';

const FRAMES = [
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

export interface SpinnerOptions {
  /** Force enable/disable. Defaults to whether stdout is a TTY. */
  enabled?: boolean;
}

export class Spinner {
  private i = 0;
  private timer: NodeJS.Timeout | null = null;
  private readonly enabled: boolean;

  constructor(
    private label = 'Working...',
    options: SpinnerOptions = {},
  ) {
    this.enabled = options.enabled ?? Boolean(process.stdout.isTTY);
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
      process.stdout.write('\r\x1b[2K\x1b[?25h');
    }
    if (finalLine !== undefined) console.log(finalLine);
  }
}

export async function withSpinner<T>(
  label: string,
  fn: () => Promise<T>,
  successLine?: string,
): Promise<T> {
  const spinner = new Spinner(label);
  spinner.start();
  try {
    const result = await fn();
    spinner.stop(successLine ?? `${green('✔')} ${label}`);
    return result;
  } catch (error) {
    spinner.stop(red(`✗ ${label}`));
    throw error;
  }
}
