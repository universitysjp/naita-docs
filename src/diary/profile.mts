import {
  allocatedMonthCount,
  allocationEnd,
  validatePeriod,
} from "./dates.mts";

// Key order is the order the TUI and CLI present the fields, so it is fixed.
// oxlint-disable-next-line sort-keys
export const PROFILE_FIELDS = {
  name: "Student name",
  privateAddress: "Private address",
  phone: "Contact phone number",
  category: "Category",
  field: "Field / trade of training",
  instituteRegistration: "Institute registration number",
  naitaRegistration: "NAITA registration number",
  establishment: "Training establishment",
  trainingLocation: "Training location",
  trainingStart: "Training start (YYYY-MM-DD)",
  trainingEnd: "Training end (YYYY-MM-DD)",
};
export const REQUIRED_FIELDS = [
  "name",
  "establishment",
  "trainingStart",
  "trainingEnd",
];
// NAITA funds six months. A longer period means the training was extended or
// turned into a permanent post, which is not part of the NAITA diary. Reading
// stays tolerant so `allocation` can repair a profile saved before this rule
// existed; saving a longer period is refused.
export const checkAllocation = (config) => {
  const months = allocatedMonthCount(config);
  if (!Number.isInteger(months) || months < 1 || months > 24) {
    throw new Error("allocatedMonths must be a whole number from 1 to 24.");
  }
  if (!config.trainingStart || !config.trainingEnd) {
    return config;
  }
  const allocated = allocationEnd(
    config.trainingStart,
    config.trainingEnd,
    config
  );
  if (config.trainingEnd > allocated) {
    throw new Error(
      `NAITA allocates ${months} months of industrial training, so training end must be ${allocated} or earlier. Run allocation to close the diary at ${allocated}, or set --field trainingEnd --text ${allocated}.`
    );
  }
  return config;
};

export const validateProfile = (config, { partial = false } = {}) => {
  // oxlint-disable-next-line anti-slop/no-runtime-typeof -- reading untyped profile JSON at its I/O boundary
  if (!config || typeof config !== "object" || Array.isArray(config)) {
    throw new Error("Profile must be a JSON object.");
  }
  for (const key of Object.keys(PROFILE_FIELDS)) {
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- boundary check on untyped profile JSON
    if (config[key] !== undefined && typeof config[key] !== "string") {
      throw new Error(`${key} must be text.`);
    }
  }
  if (!partial) {
    for (const key of REQUIRED_FIELDS) {
      if (!config[key]?.trim()) {
        throw new Error(
          `${key} is required. Use profile --field ${key} --text VALUE.`
        );
      }
    }
  }
  if (config.trainingStart && config.trainingEnd) {
    validatePeriod(config.trainingStart, config.trainingEnd);
  }
  if (!partial) {
    checkAllocation(config);
  }
  if (
    config.workingDays !== undefined &&
    (!Array.isArray(config.workingDays) ||
      !config.workingDays.every(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6
      ))
  ) {
    throw new Error(
      "workingDays must be an array of weekday numbers (Sunday 0 through Saturday 6)."
    );
  }
  return config;
};
