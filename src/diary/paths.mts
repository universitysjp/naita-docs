import {
  existsSync,
  mkdirSync,
  writeFileSync,
  mkdtempSync,
  cpSync,
  renameSync,
} from "node:fs";
import path from "node:path";

export const paths = (workspace = process.cwd()) => {
  const root = path.resolve(workspace);
  const local = path.join(root, "local");
  return {
    checklist: path.join(local, "CHECKLIST.md"),
    checklistJson: path.join(local, "checklist.json"),
    history: path.join(local, "history"),
    journal: path.join(local, "history", "changes.jsonl"),
    local,
    output: path.join(local, "output"),
    profile: path.join(local, "profile.json"),
    root,
    screenshots: path.join(local, "screenshots"),
    state: path.join(local, "state.json"),
    weeks: path.join(local, "weeks"),
  };
};

export const legacyPaths = (workspace) => {
  const { root } = paths(workspace);
  return {
    output: path.join(root, "output"),
    profile: path.join(root, "naita-diary.json"),
    screenshots: path.join(root, "diary", "screenshots"),
    state: path.join(root, "diary", "state.json"),
    weeks: path.join(root, "diary", "weeks"),
  };
};

export const hasLegacyData = (workspace) => {
  const legacy = legacyPaths(workspace);
  return [legacy.profile, legacy.state, legacy.weeks].some((file) =>
    existsSync(file)
  );
};

// Dry runs can read an older workspace without migrating or creating files.
export const readPaths = (workspace) => {
  const location = paths(workspace);
  return !existsSync(location.local) && hasLegacyData(workspace)
    ? { ...location, ...legacyPaths(workspace) }
    : location;
};

export const initializeLocal = (workspace) => {
  const location = paths(workspace);
  let migrated = false;
  if (!existsSync(location.local) && hasLegacyData(workspace)) {
    mkdirSync(location.root, { recursive: true });
    const staging = mkdtempSync(path.join(location.root, ".naita-migrate-"));
    writeFileSync(path.join(staging, ".gitignore"), "*\n", { flag: "wx" });
    const legacy = legacyPaths(workspace);
    for (const [key, name] of Object.entries({
      output: "output",
      profile: "profile.json",
      screenshots: "screenshots",
      state: "state.json",
      weeks: "weeks",
    })) {
      if (existsSync(legacy[key])) {
        cpSync(legacy[key], path.join(staging, name), {
          errorOnExist: true,
          force: false,
          recursive: true,
        });
      }
    }
    // Publish only a complete copy. Older files remain as a recoverable backup.
    renameSync(staging, location.local);
    migrated = true;
  }
  for (const file of [
    location.local,
    location.weeks,
    location.screenshots,
    location.output,
    location.history,
  ]) {
    mkdirSync(file, { recursive: true });
  }
  const ignore = path.join(location.local, ".gitignore");
  if (!existsSync(ignore)) {
    writeFileSync(ignore, "*\n", { flag: "wx" });
  }
  return migrated;
};
