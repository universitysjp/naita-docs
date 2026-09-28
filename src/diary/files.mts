import { randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
  renameSync,
} from "node:fs";
import path from "node:path";

export const readJson = (file, fallback) => {
  if (!existsSync(file) && fallback !== undefined) {
    return structuredClone(fallback);
  }
  try {
    return JSON.parse(readFileSync(file, "utf-8"));
  } catch (error) {
    throw new Error(`Cannot read ${file}: ${error.message}`, { cause: error });
  }
};

export const writeText = (file, content) => {
  mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  writeFileSync(temp, content, { mode: 0o600 });
  renameSync(temp, file);
};

export const writeJson = (file, data) => {
  writeText(file, `${JSON.stringify(data, null, 2)}\n`);
};
