import { getConfig } from './git.js';

export function originRemote(): string {
  return getConfig('gites.origin') || 'origin';
}

export function gitesRemote(): string {
  return getConfig('gites.remote') || 'gites';
}
