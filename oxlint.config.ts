import { defineConfig } from "oxlint";
import antiSlop from "ultracite/oxlint/anti-slop";
import core from "ultracite/oxlint/core";
import vitest from "ultracite/oxlint/vitest";

export default defineConfig({
  extends: [core, vitest, antiSlop],
  ignorePatterns: core.ignorePatterns,
  overrides: [
    {
      // tests/tui runs under `bun test`, not Vitest. The
      // prefer-importing-vitest-globals autofix would rewrite the
      // `bun:test` import into a `vitest` one and break the runner.
      files: ["tests/tui/**/*.{ts,mts}"],
      rules: {
        "vitest/prefer-importing-vitest-globals": "off",
      },
    },
  ],
});
