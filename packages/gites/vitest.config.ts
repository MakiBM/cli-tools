import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Git sandbox suites shell out and chdir; give them room and keep files isolated.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
