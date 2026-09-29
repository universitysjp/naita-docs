import path from "node:path";

import { validateProfile } from "../diary/profile.mts";
import { diaryStatus } from "../diary/status.mts";
import { loadDiary, paths } from "../diary/store.mts";
import { prepareDiary, draftWeeks } from "../diary/workflow.mts";
import { renderDiary } from "../pdf/render.mts";
import { ask } from "./profile.mts";

/**
 * A strict refusal that lists every gap. Telling the student only that the diary
 * is not ready sends them back to `status` to find out why, so the same gaps are
 * named here, in full, and nothing is summarised away.
 */
const strictGaps = (status) => {
  const gaps = [];
  for (const key of status.profile.requiredMissing) {
    gaps.push(`Profile field "${key}" is required and still blank.`);
  }
  if (!status.absencesConfirmed) {
    gaps.push(
      "Leave and medical dates are not confirmed. Pass --leave and --medical, using an empty string for none."
    );
  }
  if (!status.gitImported) {
    gaps.push(
      "No Git evidence has been imported (run import), and no manual note has been accepted."
    );
  }
  const incomplete = status.weeks.filter((week) => !week.complete);
  for (const week of incomplete) {
    const reasons = [];
    if (week.missing.length) {
      reasons.push(`empty sections: ${week.missing.join(", ")}`);
    }
    if (week.missingDays.length) {
      reasons.push(`work days with no note: ${week.missingDays.join(", ")}`);
    }
    if (
      !week.screenshots.images.length &&
      !week.screenshots.notRequiredReason
    ) {
      reasons.push("no screenshot and no not-required reason");
    }
    if (week.screenshots.errors.length) {
      reasons.push(
        `invalid screenshots: ${week.screenshots.errors.join("; ")}`
      );
    }
    if (week.suggestions) {
      reasons.push(`${week.suggestions} pending suggestion(s)`);
    }
    if (week.conflicts.length) {
      reasons.push(
        `work recorded on non-working dates: ${week.conflicts.join(", ")}`
      );
    }
    if (!week.reviewed) {
      reasons.push("review is out of date");
    }
    gaps.push(
      `Week ${week.number} (${week.monday} to ${week.sunday}) is incomplete: ${reasons.join("; ")}.`
    );
  }
  return gaps;
};

export const generate = async (workspace, options) => {
  const initial = loadDiary(workspace);
  validateProfile(initial.config);
  if (options["dry-run"]) {
    return prepareDiary(workspace, options, { persist: false });
  }
  const attendance = { ...options };
  for (const key of ["leave", "medical"]) {
    if (initial.state.absence[key] === null && attendance[key] === undefined) {
      // Each prompt must be answered before the next one is shown.
      // The loop dispatches the weekly sub-commands; a flat switch would just
      // move the same branches, so the complexity is inherent to the command set.
      // oxlint-disable-next-line complexity -- inherent command dispatch
      // oxlint-disable-next-line no-await-in-loop -- interactive prompts are sequential
      attendance[key] = await ask(
        `${key === "leave" ? "Authorized leave" : "Medical leave"} dates/ranges (blank for none)`
      );
    }
  }
  let diary = prepareDiary(workspace, attendance);
  if (options.agent || options["agent-command"]) {
    diary = await draftWeeks(workspace, options);
  }
  const status = await diaryStatus(diary);
  if (options.strict && !status.complete) {
    const gaps = strictGaps(status);
    throw new Error(
      `Diary is not ready for final export. ${gaps.length} gap(s) to close:\n${gaps.map((gap) => `  - ${gap}`).join("\n")}`
    );
  }
  const result = await renderDiary(
    diary,
    path.resolve(
      options.out || path.join(paths(workspace).output, "NAITA-Daily-Diary.pdf")
    ),
    options
  );
  return {
    ...result,
    complete: status.complete,
    message: `Created ${status.complete ? "" : "draft "}${result.path} (${result.pages} pages).${status.complete ? "" : " Run status to see what still needs filling."}`,
  };
};
