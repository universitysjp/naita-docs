import path from "node:path";
import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";

import { PROFILE_FIELDS } from "../diary/profile.mts";
import {
  loadProfile,
  readJson,
  saveProfile,
  ensureWeeks,
} from "../diary/store.mts";

export const ask = async (question, defaultValue = "") => {
  if (!stdin.isTTY) {
    throw new Error(
      `${question} must be supplied as an option when running non-interactively. Use an empty string for no leave/medical dates.`
    );
  }
  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = await rl.question(
      `${question}${defaultValue ? ` [${defaultValue}]` : ""}: `
    );
    return answer.trim() || defaultValue;
  } finally {
    rl.close();
  }
};
export const profileCommand = async (
  workspace,
  options,
  interactive = false
) => {
  let config = loadProfile(workspace);
  if (options.from) {
    const imported = readJson(path.resolve(options.from));
    config = { ...config, ...imported };
  }
  if (options.field) {
    if (!Object.hasOwn(PROFILE_FIELDS, options.field)) {
      throw new Error(`Unknown profile field: ${options.field}.`);
    }
    if (options.text === undefined) {
      throw new Error("--field requires --text.");
    }
    config[options.field] = options.text.trim();
  } else if (options.text !== undefined) {
    throw new Error("--text requires --field.");
  }
  if (interactive && !options.from) {
    // PROFILE_FIELDS order is the prompt order, and each answer is needed
    // before the next prompt shows its default.
    for (const [key, label] of Object.entries(PROFILE_FIELDS)) {
      // oxlint-disable-next-line no-await-in-loop -- interactive prompts are sequential
      config[key] = await ask(label, config[key]);
    }
  }
  if (interactive || options.from || options.field) {
    saveProfile(workspace, config);
    if (config.trainingStart && config.trainingEnd) {
      ensureWeeks(workspace);
    }
  }
  return config;
};
