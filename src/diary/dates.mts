export const isoDate = (date) => date.toISOString().slice(0, 10);
export const utcDate = (value) => new Date(`${value}T00:00:00Z`);
export const validDate = (value) =>
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- validating untyped input at its I/O boundary
  typeof value === "string" &&
  /^\d{4}-\d{2}-\d{2}$/u.test(value) &&
  !Number.isNaN(utcDate(value).valueOf()) &&
  isoDate(utcDate(value)) === value;
export const addDays = (value, count) => {
  const date = new Date(value);
  date.setUTCDate(date.getUTCDate() + count);
  return date;
};
export const validatePeriod = (start, end) => {
  if (!validDate(start) || !validDate(end)) {
    throw new Error("Training dates must be real dates in YYYY-MM-DD format.");
  }
  if (start > end) {
    throw new Error("Training start must be on or before training end.");
  }
  if ((utcDate(end) - utcDate(start)) / 86_400_000 > 3660) {
    throw new Error("Training period cannot exceed ten years.");
  }
};
export const parseDateList = (value = "") => {
  const dates = new Set();
  for (const entry of value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean)) {
    const parts = entry.split("..").map((part) => part.trim());
    const [start, end = start] = parts;
    if (
      parts.length > 2 ||
      !validDate(start) ||
      !validDate(end) ||
      start > end
    ) {
      throw new Error(
        `Invalid date or range: ${entry}. Use YYYY-MM-DD or YYYY-MM-DD..YYYY-MM-DD.`
      );
    }
    validatePeriod(start, end);
    for (
      let date = utcDate(start);
      isoDate(date) <= end;
      date = addDays(date, 1)
    ) {
      dates.add(isoDate(date));
    }
  }
  return dates;
};
export const displayDate = (date) => date.split("-").toReversed().join("/");

// NAITA funds six months of industrial training. Anything past that is a later
// extension or permanent employment, which the training diary does not cover,
// so the calendar stops at the allocated end even when the profile or the Git
// history runs longer. A profile may set allocatedMonths when the placement
// letter states a different number.
export const NAITA_ALLOCATION_MONTHS = 6;
export const DAYS_PER_WEEK = 7;

/**
 * Adds whole months without rolling into the next month, so a training period
 * that starts on the 31st still ends six months later rather than spilling into
 * an extra month.
 */
export const addMonths = (value, count) => {
  const date = utcDate(value);
  const day = date.getUTCDate();
  const target = new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + count, 1)
  );
  const lastDay = new Date(
    Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)
  ).getUTCDate();
  target.setUTCDate(Math.min(day, lastDay));
  return isoDate(target);
};

export const allocatedMonthCount = (config = {}) =>
  Number.isInteger(config.allocatedMonths) && config.allocatedMonths > 0
    ? config.allocatedMonths
    : NAITA_ALLOCATION_MONTHS;

/**
 * The diary stops six months after the training starts. A recorded period that
 * already ends earlier is honoured unchanged, so a short placement is not
 * padded.
 */
export const allocationEnd = (start, end, config) => {
  const allocated = addMonths(start, allocatedMonthCount(config));
  return end && end < allocated ? end : allocated;
};

export const calendar = (config, commits = [], absence = {}) => {
  validatePeriod(config.trainingStart, config.trainingEnd);
  const end = allocationEnd(config.trainingStart, config.trainingEnd, config);
  const byDate = new Map();
  for (const commit of commits) {
    // Commits after the allocated end belong to a later extension and stay out
    // of the diary entirely.
    if (commit.date > end) {
      continue;
    }
    if (!byDate.has(commit.date)) {
      byDate.set(commit.date, []);
    }
    byDate.get(commit.date).push(commit);
  }
  const leave = new Set(absence.leave || []);
  const medical = new Set(absence.medical || []);
  const off = new Set(absence.off || []);
  const start = utcDate(config.trainingStart);
  const firstMonday = addDays(start, -((start.getUTCDay() + 6) % 7));
  const weeks = [];
  for (
    let monday = firstMonday;
    isoDate(monday) <= end;
    monday = addDays(monday, 7)
  ) {
    const days = Array.from({ length: 7 }, (_, index) => {
      const date = isoDate(addDays(monday, index));
      const dayCommits = byDate.get(date) || [];
      const inPeriod = date >= config.trainingStart && date <= end;
      const scheduled = (config.workingDays || [1, 2, 3, 4, 5]).includes(
        (index + 1) % 7
      );
      let status = "work";
      if (leave.has(date)) {
        status = "leave";
      } else if (medical.has(date)) {
        status = "medical";
      } else if (off.has(date) || (!scheduled && !dayCommits.length)) {
        status = "off";
      }
      status = inPeriod ? status : "outside";
      return { commits: dayCommits, date, inPeriod, status };
    });
    weeks.push({
      days,
      monday: isoDate(monday),
      number: weeks.length + 1,
      sunday: isoDate(addDays(monday, 6)),
    });
  }
  return weeks;
};
