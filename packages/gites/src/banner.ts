import { bold, dim, renderLogo } from '@makibm/cli-kit';

const TAGLINE = 'Two-track git workflow for batching and timing client commits.';
const DESCRIPTION =
  'Batch your work session on a private branch backed up to your own remote.\nShip commits to the client branch with hand-picked timestamps, one chunk at a time.';

export function printArt(): void {
  console.log(renderLogo('GITES'));
  console.log('');
}

export function printBanner(): void {
  console.log(renderLogo('GITES', { subtitle: `${bold(TAGLINE)}\n\n${dim(DESCRIPTION)}` }));
  console.log('');
}
