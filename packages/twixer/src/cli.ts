import { formatHelp, printBanner, renderLogo } from '@makibm/cli-kit';
import { scan, type ScanOptions } from './scan.js';
import { renderHits, renderJson, renderTheme } from './render.js';
import { TailwindNotFoundError } from './theme-loader.js';
import { runTui } from './tui.js';

const SUBTITLE = 'Find Tailwind v4 arbitrary-value classes and suggest the matching default token.';

const HELP = {
  usage: 'twixer [glob|dir...] [options]',
  options: [
    { flag: '--group', summary: 'Group results by class instead of by file' },
    { flag: '--json', summary: 'Output machine-readable JSON' },
    { flag: '--no-color', summary: 'Disable ANSI colors' },
    { flag: '--counts-only', summary: 'Only print "<count>  <class>" lines, sorted desc' },
    { flag: '--ignore <p>', summary: 'Glob to ignore (repeatable)' },
    { flag: '--no-gitignore', summary: "Don't honor .gitignore files (honored by default)" },
    { flag: '--all', summary: 'Show every arbitrary class, even ones with no replacement' },
    { flag: '--theme <file>', summary: 'Extra CSS file to read theme tokens from (repeatable)' },
    { flag: '--no-theme', summary: 'Skip user CSS theme scanning (still loads tailwindcss)' },
    { flag: '--show-theme', summary: 'Print every theme token that was loaded and exit' },
    { flag: '--round', summary: 'Also suggest the NEAREST default token in orange (~>)' },
    { flag: '-h, --help', summary: 'Show this help' },
  ],
};

const collectValues = (args: string[], name: string): string[] => {
  const out: string[] = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === name && args[i + 1]) {
      out.push(args[i + 1]);
      i++;
    }
  }
  return out;
};

export async function run(argv: string[]): Promise<void> {
  if (argv.length === 0) {
    await runTui();
    return;
  }

  const flags = new Set(argv.filter((a) => a.startsWith('-')));
  const positional = argv.filter((a, i) => !a.startsWith('-') && argv[i - 1] !== '--ignore' && argv[i - 1] !== '--theme');

  if (flags.has('--help') || flags.has('-h')) {
    console.log(renderLogo('TWIXER', { subtitle: SUBTITLE }));
    console.log('');
    console.log(formatHelp(HELP));
    return;
  }

  const color = !flags.has('--no-color') && Boolean(process.stdout.isTTY);
  const options: ScanOptions = {
    patterns: positional,
    ignore: collectValues(argv, '--ignore'),
    useGitignore: !flags.has('--no-gitignore'),
    useUserTheme: !flags.has('--no-theme'),
    themeFiles: collectValues(argv, '--theme'),
    round: flags.has('--round'),
    all: flags.has('--all'),
  };

  let result;
  try {
    result = scan(options);
  } catch (error) {
    if (error instanceof TailwindNotFoundError) {
      console.error(color ? `\x1b[31mError: ${error.message}\x1b[0m` : `Error: ${error.message}`);
      process.exitCode = 1;
      return;
    }
    throw error;
  }

  if (flags.has('--show-theme')) {
    console.log(renderTheme(result, color, process.cwd()));
    return;
  }
  if (flags.has('--json')) {
    process.stdout.write(renderJson(result) + '\n');
    return;
  }
  if (result.fileCount === 0) {
    console.error(color ? `\x1b[2mNo files matched: ${result.patterns.join(', ')}\x1b[0m` : `No files matched`);
    return;
  }
  console.log(
    renderHits(result, {
      color,
      group: flags.has('--group'),
      countsOnly: flags.has('--counts-only'),
    }),
  );
}

export { printBanner };
