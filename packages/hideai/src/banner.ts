import pc from 'picocolors';
import { accent } from './colors.js';

const ART = String.raw`
██╗  ██╗██╗██████╗ ███████╗ █████╗ ██╗
██║  ██║██║██╔══██╗██╔════╝██╔══██╗██║
███████║██║██║  ██║█████╗  ███████║██║
██╔══██║██║██║  ██║██╔══╝  ██╔══██║██║
██║  ██║██║██████╔╝███████╗██║  ██║██║
╚═╝  ╚═╝╚═╝╚═════╝ ╚══════╝╚═╝  ╚═╝╚═╝`;

const TAGLINE = 'Block AI assistant trailers from your git commits.';
const DESCRIPTION =
  'Pick which agents to block (Claude, Copilot, Cursor, ChatGPT, and more).\nA tiny portable bash hook does the matching — no Node at commit time.';

export function printArt(): void {
  console.log(accent(ART));
  console.log('');
}

export function printBanner(): void {
  console.log(accent(ART));
  console.log(pc.bold(TAGLINE));
  console.log('');
  console.log(pc.dim(DESCRIPTION));
  console.log('');
}
