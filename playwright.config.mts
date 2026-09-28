import { defineConfig } from "@playwright/test";

export default defineConfig({
  fullyParallel: false,
  outputDir: "output/playwright/results",
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "output/playwright/report" }],
  ],
  testDir: "./tests/e2e",
  timeout: 60_000,
  use: {
    headless: true,
    trace: "retain-on-failure",
    viewport: { height: 1400, width: 1000 },
  },
  workers: 1,
});
