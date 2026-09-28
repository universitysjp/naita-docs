import path from "node:path";

import { validateProfile } from "../diary/profile.mts";
import { diaryStatus } from "../diary/status.mts";
import { loadDiary, paths } from "../diary/store.mts";
import { prepareDiary, draftWeeks } from "../diary/workflow.mts";
import { renderDiary } from "../pdf/render.mts";
import { ask } from "./profile.mts";

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
    throw new Error(
      "Diary is not ready for final export. Run status to see missing entries, screenshots, suggestions, attendance, and reviews."
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
