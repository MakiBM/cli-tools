import pc from 'picocolors';
import { accent } from './colors.js';

const ART = String.raw`
 ██████╗ ██╗████████╗██████╗  █████╗  ██████╗███████╗
██╔════╝ ██║╚══██╔══╝██╔══██╗██╔══██╗██╔════╝██╔════╝
██║  ███╗██║   ██║   ██████╔╝███████║██║     █████╗
██║   ██║██║   ██║   ██╔═══╝ ██╔══██║██║     ██╔══╝
╚██████╔╝██║   ██║   ██║     ██║  ██║╚██████╗███████╗
 ╚═════╝ ╚═╝   ╚═╝   ╚═╝     ╚═╝  ╚═╝ ╚═════╝╚══════╝`;

const TAGLINE = 'Two-track git workflow for batching and timing client commits.';
const DESCRIPTION =
  'Batch your work session on a private branch backed up to your own remote.\nShip commits to the client branch with hand-picked timestamps, one chunk at a time.';

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
