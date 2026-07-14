import { bold, dim, renderLogo } from '@makibm/cli-kit';

const TAGLINE = 'Block AI assistant trailers from your git commits.';
const DESCRIPTION =
  'Pick which agents to block (Claude, Copilot, Cursor, ChatGPT, and more).\nA tiny portable bash hook does the matching — no Node at commit time.';

export function printArt(): void {
  console.log(renderLogo('HIDEAI'));
  console.log('');
}

export function printBanner(): void {
  console.log(renderLogo('HIDEAI', { subtitle: `${bold(TAGLINE)}\n\n${dim(DESCRIPTION)}` }));
  console.log('');
}
