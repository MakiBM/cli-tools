import { Spinner as KitSpinner, green, red } from '@makibm/cli-kit';

function spinnerEnabled(): boolean {
  return Boolean(process.stdout.isTTY) && !process.env.GITES_VERBOSE;
}

export class Spinner extends KitSpinner {
  constructor(label = 'Working...') {
    super(label, { enabled: spinnerEnabled() });
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
