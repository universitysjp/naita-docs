import { createHash, randomUUID } from "node:crypto";
import {
  existsSync,
  readFileSync,
  readdirSync,
  mkdirSync,
  appendFileSync,
} from "node:fs";
import path from "node:path";
import { isDeepStrictEqual } from "node:util";

import { paths } from "./paths.mts";

export const readHistory = (workspace) => {
  const file = paths(workspace).journal;
  if (!existsSync(file)) {
    return [];
  }
  return readFileSync(file, "utf-8")
    .split("\n")
    .filter((line) => line.trim())
    .map((line, index) => {
      try {
        const event = JSON.parse(line);
        if (
          event.schemaVersion !== 1 ||
          !Array.isArray(event.changes) ||
          !event.changes.every(
            (change) =>
              change &&
              // oxlint-disable-next-line anti-slop/no-runtime-typeof -- validating a parsed journal line at its I/O boundary
              typeof change.path === "string" &&
              Object.hasOwn(change, "before") &&
              Object.hasOwn(change, "after")
          )
        ) {
          throw new Error("Invalid event");
        }
        return event;
      } catch {
        throw new Error(
          `Cannot read history event ${index + 1} in ${file}. Restore the log before continuing.`
        );
      }
    });
};

const currentFiles = (workspace) => {
  const location = paths(workspace);
  const files = {};
  const capture = (file, json) => {
    if (!existsSync(file)) {
      return;
    }
    const bytes = readFileSync(file);
    const key = path.relative(location.local, file).split("\\").join("/");
    if (json) {
      const text = bytes.toString("utf-8");
      try {
        files[key] = { kind: "json", value: JSON.parse(text) };
      } catch {
        files[key] = { kind: "text", value: text };
      }
    } else {
      files[key] = {
        bytes: bytes.length,
        kind: "file",
        sha256: createHash("sha256").update(bytes).digest("hex"),
      };
    }
  };
  const images = (folder) => {
    if (!existsSync(folder)) {
      return;
    }
    for (const file of readdirSync(folder, { withFileTypes: true })) {
      if (file.isDirectory()) {
        images(path.join(folder, file.name));
      } else if (
        file.isFile() &&
        /\.(?<extension>png|jpe?g)$/iu.test(file.name)
      ) {
        capture(path.join(folder, file.name), false);
      }
    }
  };
  capture(location.profile, true);
  capture(location.state, true);
  if (existsSync(location.weeks)) {
    for (const file of readdirSync(location.weeks)
      .filter((name) => name.endsWith(".json"))
      .toSorted()) {
      capture(path.join(location.weeks, file), true);
    }
  }
  images(location.screenshots);
  return files;
};

// JSONL is the source of truth: each append includes before/after values, so a
// deleted or edited point remains recoverable without a separate mutable index.
export const checkpoint = (
  workspace,
  action,
  details = {},
  recordUnchanged = false
) => {
  const location = paths(workspace);
  if (!existsSync(location.local)) {
    return;
  }
  const previous = {};
  for (const event of readHistory(workspace)) {
    for (const change of event.changes) {
      if (change.after === null) {
        Reflect.deleteProperty(previous, change.path);
      } else {
        previous[change.path] = change.after;
      }
    }
  }
  const current = currentFiles(workspace);
  const changes = [
    ...new Set([...Object.keys(previous), ...Object.keys(current)]),
  ]
    .toSorted()
    .filter((file) => !isDeepStrictEqual(previous[file], current[file]))
    .map((file) => ({
      after: current[file] ?? null,
      before: previous[file] ?? null,
      path: file,
    }));
  if (!changes.length && !recordUnchanged) {
    return;
  }
  // Key order decides precedence against the caller-supplied ...details spread.
  // oxlint-disable-next-line sort-keys
  const event = {
    schemaVersion: 1,
    id: randomUUID(),
    at: new Date().toISOString(),
    action,
    ...details,
    changes,
  };
  mkdirSync(location.history, { recursive: true });
  appendFileSync(location.journal, `${JSON.stringify(event)}\n`, {
    mode: 0o600,
  });
  return event;
};
