import { randomUUID, createHash } from "node:crypto";

// Key order is the order sections are written, shown, and exported, so it is fixed.
// oxlint-disable-next-line sort-keys
export const SECTIONS = {
  work: "Work carried out",
  problems: "Problems encountered",
  solutions: "How they were solved",
  learning: "Learning",
  improvements: "Improvements for next week",
};
export const cleanText = (value) => {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- rejecting non-text input at its I/O boundary
  if (typeof value !== "string" || !value.trim()) {
    throw new Error("A point must contain some text.");
  }
  const text = value
    .replace(/^\s*[-*•]\s+/u, "")
    // oxlint-disable-next-line no-control-regex -- remove terminal control bytes from user notes
    .replaceAll(/[\u0000-\u001F\u007F-\u009F]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();
  if (!text) {
    throw new Error("A point must contain some text.");
  }
  if (text.length > 5000) {
    throw new Error(
      "Keep each point under 5,000 characters; split longer notes into several points."
    );
  }
  return text;
};
export const stableId = (value) =>
  createHash("sha256").update(value).digest("hex").slice(0, 16);
export const point = (text, source = "manual", evidence = []) => ({
  evidence,
  id: randomUUID(),
  source,
  text: cleanText(text),
});
export const blankWeek = (week) => ({
  days: Object.fromEntries(week.days.map((day) => [day.date, []])),
  dismissedSuggestions: [],
  monday: week.monday,
  number: week.number,
  reviewedFingerprint: null,
  schemaVersion: 1,
  screenshots: { captions: {}, notRequiredReason: "" },
  sections: Object.fromEntries(Object.keys(SECTIONS).map((key) => [key, []])),
  suggestions: [],
  sunday: week.sunday,
});
const checkCaptions = (entry) => {
  if (
    !entry.screenshots ||
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- boundary check on untyped week JSON
    typeof entry.screenshots.captions !== "object" ||
    entry.screenshots.captions === null ||
    Array.isArray(entry.screenshots.captions) ||
    !Object.values(entry.screenshots.captions).every(
      // oxlint-disable-next-line anti-slop/no-runtime-typeof -- boundary check on untyped week JSON
      (text) => typeof text === "string"
    ) ||
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- boundary check on untyped week JSON
    typeof entry.screenshots.notRequiredReason !== "string"
  ) {
    throw new Error("Invalid screenshot captions or exemption reason.");
  }
};
export const validateWeek = (entry, expected) => {
  if (
    entry.schemaVersion !== 1 ||
    entry.monday !== expected.monday ||
    entry.sunday !== expected.sunday ||
    entry.number !== expected.number
  ) {
    throw new Error(
      "Week dates/number do not match the training period. Use a separate --workspace when changing the period."
    );
  }
  const ids = new Set();
  const checkPoints = (points) => {
    if (!Array.isArray(points)) {
      throw new TypeError("Weekly sections and daily points must be arrays.");
    }
    for (const value of points) {
      if (
        !value ||
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- boundary check on untyped week JSON
        typeof value.id !== "string" ||
        !value.id ||
        ids.has(value.id)
      ) {
        throw new Error("Every point and suggestion needs a unique id.");
      }
      ids.add(value.id);
      cleanText(value.text);
      if (
        value.evidence !== undefined &&
        (!Array.isArray(value.evidence) ||
          // oxlint-disable-next-line anti-slop/no-runtime-typeof -- boundary check on untyped week JSON
          !value.evidence.every((item) => typeof item === "string"))
      ) {
        throw new Error("Point evidence must be an array of commit hashes.");
      }
    }
  };
  for (const key of Object.keys(SECTIONS)) {
    checkPoints(entry.sections?.[key]);
  }
  for (const day of expected.days) {
    checkPoints(entry.days?.[day.date]);
  }
  if (
    Object.keys(entry.days).some(
      (date) => !expected.days.some((day) => day.date === date)
    )
  ) {
    throw new Error("Daily notes contain a date outside this week.");
  }
  checkPoints(entry.suggestions);
  for (const suggestion of entry.suggestions) {
    if (
      !Object.hasOwn(SECTIONS, suggestion.section) ||
      !["draft", "question"].includes(suggestion.kind)
    ) {
      throw new Error("Invalid suggestion section or kind.");
    }
  }
  if (
    !Array.isArray(entry.dismissedSuggestions) ||
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- boundary check on untyped week JSON
    !entry.dismissedSuggestions.every((id) => typeof id === "string")
  ) {
    throw new Error("dismissedSuggestions must be an array of ids.");
  }
  checkCaptions(entry);
  return entry;
};
export const describeCommit = (subject) => {
  const text = cleanText(subject)
    .replace(/^\[[^\]]+\]\s*/u, "")
    .replace(
      /^(?<type>feat|fix|docs|test|refactor|chore|style|perf|build|ci)(?<scope>\([^)]*\))?!?:\s*/iu,
      ""
    );
  const verbs = {
    add: "Added",
    configure: "Configured",
    create: "Created",
    fix: "Fixed",
    handle: "Handled",
    implement: "Implemented",
    improve: "Improved",
    prevent: "Prevented",
    redesign: "Redesigned",
    refactor: "Refactored",
    remove: "Removed",
    support: "Supported",
    test: "Tested",
    update: "Updated",
    use: "Used",
    write: "Wrote",
  };
  const first = text.split(" ")[0].toLowerCase();
  const result = verbs[first]
    ? text.replace(/^\S+/u, verbs[first])
    : text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?]$/u.test(result) ? result : `${result}.`;
};
// Git subjects are never printed in the diary. A day with no written note means
// the trainee was still on the week's task, which is a normal day, and this is
// the wording the PDF shows for it. Status reports the day so the student can
// replace it with their own sentence.
export const CONTINUED_WORK_TEXT =
  "Carried on with the task that was already in progress.";

export const dailyPoints = (day, entry) => {
  if (day.status === "outside") {
    return [];
  }
  if (day.status !== "work") {
    return [
      {
        text: {
          leave: "Authorized leave.",
          medical: "Medical leave.",
          off: "Non-working day.",
        }[day.status],
      },
    ];
  }
  const manual = entry.days[day.date];
  if (manual.length) {
    return manual;
  }
  // A work day with no note of the student's own is still a working day, and it
  // says so. The text is fixed and mentions nothing about the repository, so a
  // commit subject can never reach the PDF. The student's own wording is used
  // whenever they have written any, and status reports the days that still need
  // a sentence.
  return [{ text: CONTINUED_WORK_TEXT }];
};
export const editPoint = (
  entry,
  { section, date, text, before, id, remove = false }
) => {
  if (Boolean(section) === Boolean(date)) {
    throw new Error("Choose exactly one --section or --date.");
  }
  if (section && !Object.hasOwn(SECTIONS, section)) {
    throw new Error(
      `Section must be one of: ${Object.keys(SECTIONS).join(", ")}.`
    );
  }
  const points = date ? entry.days[date] : entry.sections[section];
  if (!points) {
    throw new Error("Date is not in this week.");
  }
  if (id && before) {
    throw new Error("Use --id to edit or --before to insert, not both.");
  }
  if (remove && !id) {
    throw new Error("--remove requires --id.");
  }
  if (id) {
    const index = points.findIndex((item) => item.id === id);
    if (index === -1) {
      throw new Error(`Point ${id} not found.`);
    }
    if (remove) {
      points.splice(index, 1);
    } else {
      points[index] = {
        ...points[index],
        source: "manual",
        text: cleanText(text),
      };
    }
    return;
  }
  const index = before
    ? points.findIndex((item) => item.id === before)
    : points.length;
  if (index < 0) {
    throw new Error(`Point ${before} not found.`);
  }
  points.splice(index, 0, point(text));
};
