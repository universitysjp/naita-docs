import path from "node:path";

import { resolveSuggestion } from "../ai/suggestions.mts";
import { editPoint, point, SECTIONS } from "../diary/entries.mts";
import { readJson } from "../diary/files.mts";
import { scanScreenshots } from "../diary/screenshots.mts";
import { diaryStatus } from "../diary/status.mts";
import { ensureWeeks, selectWeek, saveWeek } from "../diary/store.mts";

// Draft points are objects so evidence hashes can travel with the wording.
const textList = (value, label) => {
  if (!Array.isArray(value) || !value.length) {
    throw new Error(`${label} needs at least one point.`);
  }
  return value.map((item) => {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- validating an untyped draft file at its I/O boundary
    if (!item || typeof item.text !== "string") {
      throw new TypeError(
        `${label} needs points shaped as { "text": "..." }, optionally with evidence.`
      );
    }
    return point(item.text, "manual", item.evidence ?? []);
  });
};
export const parseRewriteDraft = (raw) => {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- validating an untyped draft file at its I/O boundary
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("The rewrite file must be a JSON object.");
  }
  const sections = {};
  for (const key of Object.keys(SECTIONS)) {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- validating an untyped draft file at its I/O boundary
    if (typeof raw.sections?.[key] !== "object") {
      throw new TypeError(`The rewrite file needs at least one ${key} point.`);
    }
    sections[key] = textList(raw.sections[key], key);
  }
  const days = {};
  for (const [date, texts] of Object.entries(raw.days ?? {})) {
    days[date] = textList(texts, date);
  }
  return { days, sections, week: raw.week };
};
// Rewriting a whole week is a deliberate correction of earlier wording, not the
// way to make a small change. The saved history keeps every replaced point.
export const rewriteWeek = (workspace, options) => {
  if (!options.from) {
    throw new Error("rewrite requires --from FILE with the full week wording.");
  }
  if (!options.reason) {
    throw new Error(
      "rewrite requires --reason TEXT explaining the correction."
    );
  }
  const draft = parseRewriteDraft(readJson(path.resolve(options.from)));
  const diary = ensureWeeks(workspace);
  const week = selectWeek(diary, options.week ?? draft.week);
  for (const key of Object.keys(SECTIONS)) {
    week.entry.sections[key].splice(
      0,
      week.entry.sections[key].length,
      ...draft.sections[key]
    );
  }
  for (const [date, texts] of Object.entries(draft.days)) {
    if (!week.entry.days[date]) {
      throw new Error(`${date} is not in week ${week.number}.`);
    }
    week.entry.days[date].splice(0, week.entry.days[date].length, ...texts);
  }
  // A day without a written note is not a day without work, but the week is not
  // finished either, so require the missing days to be listed explicitly.
  const unfilled = week.days
    .filter((day) => day.status === "work")
    .filter((day) => !week.entry.days[day.date].length)
    .map((day) => day.date);
  if (unfilled.length) {
    throw new Error(
      `Week ${week.number} still has no work note for ${unfilled.join(", ")}. Add those days to the rewrite file.`
    );
  }
  week.entry.reviewedFingerprint = null;
  saveWeek(workspace, week);
  return {
    file: week.file,
    message: `Rewrote week ${week.number} from ${path.basename(path.resolve(options.from))}. The week needs a new review.`,
    week: week.entry,
  };
};
// oxlint-disable-next-line complexity -- inherent command dispatch
export const weeklyCommand = async (command, workspace, options) => {
  if (command === "rewrite") {
    return rewriteWeek(workspace, options);
  }
  const diary = ensureWeeks(workspace);
  const week = selectWeek(diary, options.week);
  if (command === "add" || command === "edit") {
    if (command === "edit" && !options.id) {
      throw new Error("edit requires --id.");
    }
    if (options.date) {
      const day = week.days.find((item) => item.date === options.date);
      if (!day || day.status !== "work") {
        throw new Error(
          "Daily work can only be added to a work date. Update attendance first."
        );
      }
      if (command === "add" && !week.entry.days[day.date].length) {
        // Start a day with just the trainee's own note. An empty day is not a
        // problem to patch over with text taken from a commit.
        week.entry.days[day.date] = [];
      }
    }
    editPoint(week.entry, options);
  } else if (command === "accept" || command === "dismiss") {
    const available = new Set(
      week.days
        .filter((day) => day.status === "work")
        .flatMap((day) => day.commits.map((commit) => commit.hash))
    );
    if (command === "accept") {
      const selected = week.entry.suggestions.filter((item) =>
        options["accept-drafts"]
          ? item.kind === "draft" && item.section === "work"
          : item.id === options.id
      );
      if (
        selected.some((item) =>
          item.evidence.some((hash) => !available.has(hash))
        )
      ) {
        throw new Error(
          "Suggestion evidence no longer belongs to a work date in this week. Check attendance/history and dismiss the stale suggestion."
        );
      }
    }
    if (options["accept-drafts"]) {
      if (options.id || options.text || options.before) {
        throw new Error(
          "--accept-drafts cannot be combined with --id, --text, or --before."
        );
      }
      for (const suggestion of week.entry.suggestions) {
        if (suggestion.kind === "draft" && suggestion.section === "work") {
          resolveSuggestion(week.entry, suggestion.id);
        }
      }
    } else {
      if (!options.id) {
        throw new Error("Choose a suggestion with --id.");
      }
      resolveSuggestion(week.entry, options.id, {
        before: options.before,
        dismiss: command === "dismiss",
        text: options.text,
      });
    }
  } else if (command === "review") {
    const diaryStatusResult = await diaryStatus(diary);
    const status = diaryStatusResult.weeks.find(
      (item) => item.number === week.number
    );
    if (
      status.filled !== status.total ||
      status.suggestions ||
      status.conflicts.length ||
      diary.state.absence.leave === null ||
      diary.state.absence.medical === null
    ) {
      const gaps = [
        ...status.missing,
        ...status.missingDays,
        ...status.screenshots.errors,
        ...(status.suggestions
          ? [`${status.suggestions} pending suggestions`]
          : []),
        ...(status.conflicts.length
          ? [`attendance conflicts: ${status.conflicts.join(", ")}`]
          : []),
        ...(!status.screenshots.images.length &&
        !status.screenshots.notRequiredReason
          ? ["screenshots needed"]
          : []),
        ...(diary.state.absence.leave === null ||
        diary.state.absence.medical === null
          ? ["confirm leave and medical dates"]
          : []),
      ];
      throw new Error(
        `Week ${week.number} is not ready for review: ${gaps.join("; ")}. Run status for details.`
      );
    }
    week.entry.reviewedFingerprint = status.fingerprint;
  } else if (command === "screenshots") {
    if (options.file !== undefined) {
      if (
        path.basename(options.file) !== options.file ||
        !options.file ||
        options.text === undefined
      ) {
        throw new Error(
          "Use --file NAME (no directories) with --text CAPTION."
        );
      }
      const inventory = await scanScreenshots(week);
      if (!inventory.images.some((image) => image.name === options.file)) {
        throw new Error(
          "Screenshot not found or invalid. Place it in the week folder first."
        );
      }
      week.entry.screenshots.captions[options.file] = options.text.trim();
    } else if (options.text !== undefined) {
      throw new Error("--text requires a screenshot --file.");
    }
    if (options.reason !== undefined) {
      week.entry.screenshots.notRequiredReason = options.reason.trim();
    }
    if (options.file === undefined && options.reason === undefined) {
      return scanScreenshots(week);
    }
  }
  saveWeek(workspace, week);
  return {
    file: week.file,
    message: `Saved week ${week.number}.`,
    week: week.entry,
  };
};
