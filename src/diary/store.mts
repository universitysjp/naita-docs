import { existsSync, mkdirSync, readdirSync, renameSync } from "node:fs";
import path from "node:path";

import { validateAbsence } from "./attendance.mts";
import {
  addMonths,
  allocatedMonthCount,
  allocationEnd,
  calendar,
  validDate,
} from "./dates.mts";
import { blankWeek, validateWeek } from "./entries.mts";
import { readJson, writeJson } from "./files.mts";
import { initializeLocal, paths, readPaths } from "./paths.mts";
import { checkAllocation, validateProfile } from "./profile.mts";

export { readJson, writeJson } from "./files.mts";
export { paths } from "./paths.mts";
export const weekKey = (week) =>
  `week-${String(week.number).padStart(2, "0")}-${week.monday}`;
export const loadProfile = (workspace) =>
  readJson(readPaths(workspace).profile, {});
export const saveProfile = (workspace, config) => {
  validateProfile(config, { partial: true });
  checkAllocation(config);
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
  // Reading stays tolerant of a period longer than the allocation, so `allocation`
  // can repair a profile saved before the six-month rule existed. Saving is
  // where the rule is enforced.
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
    // Weeks past the NAITA allocation belong to a later extension or a permanent
    // post. Move them aside instead of failing, so the diary only covers the
    // six funded months and the extra material stays recoverable.
    const archive = path.join(
      location.local,
      "archive",
      "beyond-training-allocation"
    );
    for (const file of readdirSync(location.weeks).filter((name) =>
      name.endsWith(".json")
    )) {
      if (expected.has(file)) {
        continue;
      }
      const monday = file.slice("week-XX-".length, "week-XX-".length + 10);
      if (
        validDate(monday) &&
        monday > allocationEnd(config.trainingStart, config.trainingEnd, config)
      ) {
        mkdirSync(archive, { recursive: true });
        renameSync(path.join(location.weeks, file), path.join(archive, file));
        const folder = path.join(location.screenshots, file.slice(0, -5));
        if (existsSync(folder)) {
          renameSync(folder, path.join(archive, path.basename(folder)));
        }
        continue;
      }
      throw new Error(
        `Unexpected week file ${file}. Restore the training dates or move this file to an archive.`
      );
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

// NAITA funds six months. When a profile runs longer, the extra weeks are a
// later extension or a permanent post: shorten the recorded period and move the
// surplus weeks, screenshots, absence dates, and period to the archive.
export const applyAllocation = (workspace) => {
  const location = readPaths(workspace);
  const config = readJson(location.profile, {});
  if (!config.trainingStart) {
    throw new Error(
      "Set --field trainingStart before applying the allocation."
    );
  }
  const months = allocatedMonthCount(config);
  const end = addMonths(config.trainingStart, months);
  if (config.trainingEnd && config.trainingEnd <= end) {
    return {
      alreadyAllocated: true,
      archivedWeeks: [],
      config,
      end,
      message: `The diary already stops at ${end}, the ${months}-month NAITA allocation.`,
    };
  }
  const state = loadState(workspace);
  const archive = path.join(
    location.local,
    "archive",
    "beyond-training-allocation"
  );
  const archivedWeeks = [];
  if (existsSync(location.weeks)) {
    for (const file of readdirSync(location.weeks)
      .filter((name) => name.endsWith(".json"))
      .toSorted()) {
      const monday = file.slice("week-XX-".length, "week-XX-".length + 10);
      if (!validDate(monday) || monday <= end) {
        continue;
      }
      mkdirSync(archive, { recursive: true });
      renameSync(path.join(location.weeks, file), path.join(archive, file));
      const folder = path.join(location.screenshots, file.slice(0, -5));
      if (existsSync(folder)) {
        renameSync(folder, path.join(archive, path.basename(folder)));
      }
      archivedWeeks.push(file);
    }
  }
  for (const key of ["leave", "medical", "off"]) {
    state.absence[key] = (state.absence[key] || []).filter(
      (date) => date <= end
    );
  }
  if (state.period) {
    state.period.end = end;
  }
  writeJson(location.profile, { ...config, trainingEnd: end });
  saveState(workspace, state);
  return {
    alreadyAllocated: false,
    archivedWeeks,
    config: { ...config, trainingEnd: end },
    end,
    message: `Training period now ends ${end}, the ${months}-month NAITA allocation. ${archivedWeeks.length} later week(s) moved to ${archive}. Work after ${end} is a later extension or permanent post and stays out of the NAITA diary.`,
  };
};
