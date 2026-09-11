import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Git sandbox suites shell out and chdir; give them room and keep files isolated.
    testTimeout: 30_000,
    hookTimeout: 30_000,
    // Every file spawns dozens of git processes; more workers than this and the
    // per-command latency under load pushes single tests past the timeout.
    maxWorkers: 3,
  },
});
