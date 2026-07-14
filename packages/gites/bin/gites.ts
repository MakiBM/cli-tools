#!/usr/bin/env node
import { run } from '../src/cli.js';

interface ExitError {
  message?: string;
  exitCode?: number;
}

run(process.argv.slice(2)).catch((err: ExitError) => {
  if (err?.message) console.error(err.message);
  process.exit(typeof err?.exitCode === 'number' ? err.exitCode : 1);
});
