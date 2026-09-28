#!/usr/bin/env bun

import path from "node:path";
import { parseArgs } from "node:util";

import { createCliRenderer } from "@opentui/core";

import { createDiaryApp } from "./tui/app";
import { cliClient } from "./tui/client";

const main = async () => {
  const { values } = parseArgs({
    args: process.argv.slice(2).filter((arg) => arg !== "--"),
    options: { workspace: { type: "string" } },
    strict: true,
  });
  const renderer = await createCliRenderer({
    backgroundColor: "#10131a",
    consoleMode: "disabled",
    exitOnCtrlC: true,
  });
  try {
    await createDiaryApp(
      renderer,
      cliClient(path.resolve(values.workspace || process.cwd()))
    ).start();
  } catch (error) {
    renderer.destroy();
    throw error;
  }
};

try {
  await main();
} catch (error) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
