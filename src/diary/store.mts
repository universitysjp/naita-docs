import { existsSync, mkdirSync, readdirSync } from "node:fs";
import path from "node:path";

import { validateAbsence } from "./attendance.mts";
import { calendar } from "./dates.mts";
import { blankWeek, validateWeek } from "./entries.mts";
import { readJson, writeJson } from "./files.mts";
import { initializeLocal, paths, readPaths } from "./paths.mts";
import { validateProfile } from "./profile.mts";

export { readJson, writeJson } from "./files.mts";
export { paths } from "./paths.mts";
export const weekKey = (week) =>
  `week-${String(week.number).padStart(2, "0")}-${week.monday}`;
export const loadProfile = (workspace) =>
  readJson(readPaths(workspace).profile, {});
export const saveProfile = (workspace, config) => {
  validateProfile(config, { partial: true });
  initializeLocal(workspace);
  const location = paths(workspace);
  const state = readJson(location.state, {});
  if (
    state.period &&
    (state.period.start !== config.trainingStart ||
      state.period.end !== config.trainingEnd)
  ) {
    throw new Error(
      "Training dates already have saved weeks. Use another --workspace for a different training period."
    );
  }
  writeJson(location.profile, config);
};
export const loadState = (workspace) => {
  const state = readJson(readPaths(workspace).state, {
    absence: { leave: null, medical: null, off: [] },
    author: "",
    commits: [],
    importedAt: null,
    repos: [],
    schemaVersion: 1,
  });
  if (
    state.schemaVersion !== 1 ||
    !Array.isArray(state.commits) ||
    !Array.isArray(state.repos) ||
    !state.absence ||
    !["leave", "medical", "off"].every(
      (key) => state.absence[key] === null || Array.isArray(state.absence[key])
    )
  ) {
    throw new Error(
      "Invalid local/state.json. Restore its structure before continuing."
    );
  }
  return state;
};
export const saveState = (workspace, state) => {
  writeJson(paths(workspace).state, state);
};
export const weekPath = (workspace, week) =>
  path.join(paths(workspace).weeks, `${weekKey(week)}.json`);
export const screenshotPath = (workspace, week) =>
  path.join(paths(workspace).screenshots, weekKey(week));
export const loadDiary = (workspace) => {
  const location = readPaths(workspace);
  const config = validateProfile(loadProfile(workspace), { partial: true });
  const state = loadState(workspace);
  validateAbsence(state.absence, config);
  if (
    state.period &&
    (state.period.start !== config.trainingStart ||
      state.period.end !== config.trainingEnd)
  ) {
    throw new Error(
      "Profile training dates differ from saved weeks. Restore the dates or use another --workspace."
    );
  }
  const weeks = calendar(config, state.commits, state.absence).map((week) => ({
    ...week,
    entry: validateWeek(
      readJson(
        path.join(location.weeks, `${weekKey(week)}.json`),
        blankWeek(week)
      ),
      week
    ),
    file: path.join(location.weeks, `${weekKey(week)}.json`),
    screenshotFolder: path.join(location.screenshots, weekKey(week)),
  }));
  // Catch edited dates and orphaned files instead of silently excluding them.
  if (existsSync(location.weeks)) {
    const expected = new Set(weeks.map((week) => `${weekKey(week)}.json`));
    for (const file of readdirSync(location.weeks).filter((name) =>
      name.endsWith(".json")
    )) {
      if (!expected.has(file)) {
        throw new Error(
          `Unexpected week file ${file}. Restore the training dates or move this file to an archive.`
        );
      }
    }
  }
  return { config, state, weeks };
};
export const ensureWeeks = (workspace) => {
  initializeLocal(workspace);
  const diary = loadDiary(workspace);
  for (const week of diary.weeks) {
    if (!existsSync(week.file)) {
      writeJson(week.file, week.entry);
    }
    mkdirSync(week.screenshotFolder, { recursive: true });
  }
  if (!diary.state.period) {
    diary.state.period = {
      end: diary.config.trainingEnd,
      start: diary.config.trainingStart,
    };
    saveState(workspace, diary.state);
  }
  return diary;
};
export const selectWeek = (diary, selector) => {
  if (!selector) {
    throw new Error("Choose a week with --week NUMBER or its Monday date.");
  }
  const week = diary.weeks.find(
    (candidate) =>
      String(candidate.number) === String(selector) ||
      candidate.monday === selector
  );
  if (!week) {
    throw new Error(`Week ${selector} is not in the training period.`);
  }
  return week;
};
export const saveWeek = (workspace, week) => {
  validateWeek(week.entry, week);
  writeJson(weekPath(workspace, week), week.entry);
};
