#!/usr/bin/env bun

import { main } from "./cli/main.mts";

try {
  await main();
} catch (error) {
  console.error(`Error: ${error instanceof Error ? error.message : error}`);
  process.exitCode = 1;
}
