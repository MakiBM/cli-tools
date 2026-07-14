export { checkbox, confirm, input, select } from '@inquirer/prompts';

import { select } from '@inquirer/prompts';

export interface MenuChoice<T> {
  name: string;
  value: T;
  description?: string;
}

export interface MenuOptions<T> {
  message: string;
  choices: Array<MenuChoice<T>>;
}

/** Thin wrapper over inquirer's select for a consistent main-menu prompt. */
export function menu<T>(options: MenuOptions<T>): Promise<T> {
  return select<T>({ message: options.message, choices: options.choices });
}
