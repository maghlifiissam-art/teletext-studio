import { defineConfig } from "vitest/config";

// Vitest configuration for Teletext Studio.
//
// Single-execution mode is used for all automated runs: invoke via the
// `test` npm script (`vitest run`), which never enters watch mode. Watch
// mode (`npm run test:watch`) is for local development only.
//
// The model tests (tasks 1-2) are pure and need no DOM, so the default
// environment is "node". Later UI/DOM/canvas tasks override the environment
// per-file with a `// @vitest-environment jsdom` / `happy-dom` pragma.
export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.js"],
    // Single execution only — never watch in CI/automated runs.
    watch: false,
    reporters: "default",
  },
});
