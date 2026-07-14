import { getConfig } from './git.js';

export function originRemote(): string {
  return getConfig('gitpace.origin') || 'origin';
}

export function gitpaceRemote(): string {
  return getConfig('gitpace.remote') || 'gitpace';
}
