import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    hookTimeout: 30_000,
    include: ["tests/unit/**/*.test.mts", "tests/integration/**/*.test.mts"],
    testTimeout: 30_000,
  },
});
