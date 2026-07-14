#!/usr/bin/env node
import { run } from "../src/cli.js";

interface ExitError {
  message?: string;
  exitCode?: number;
  name?: string;
}

run(process.argv.slice(2)).catch((err: ExitError) => {
  if (err?.name === "ExitPromptError") process.exit(0);
  if (err?.message) console.error(err.message);
  process.exit(typeof err?.exitCode === "number" ? err.exitCode : 1);
});
