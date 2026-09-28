import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { execute } from "../../src/cli/main.mts";
import { readHistory } from "../../src/diary/history.mts";
import { checkAllocation } from "../../src/diary/profile.mts";
import {
  loadDiary,
  loadProfile,
  paths,
  readJson,
} from "../../src/diary/store.mts";
import { commit, fixture, PROFILE, seedRepo } from "../helpers/fixtures.mts";

let context;
afterEach(() => context?.cleanup());

const weekFile = (workspace, number) =>
  readJson(
    path.join(
      paths(workspace).weeks,
      `week-${String(number).padStart(2, "0")}-2026-04-06.json`
    ),
    null
  );
const sections = (work) => ({
  improvements: [{ text: "Check the empty state earlier next week." }],
  learning: [{ text: "Learned to keep one definition of the fields." }],
  problems: [{ text: "The filter was applied to the wrong table." }],
  solutions: [
    { text: "Passed the table name through from the search screen." },
  ],
  work: [{ text: work }],
});
const weekDraft = (
  work = "Rebuilt the task list so it can be searched by title."
) => ({
  days: {
    "2026-04-06": [{ text: "Set out the shape of the new screen." }],
    "2026-04-07": [{ text: "Wired the list to the service." }],
    "2026-04-08": [{ text: "Sorted out why the filter did not apply." }],
    "2026-04-09": [{ text: "Checked the layout on a narrow window." }],
    "2026-04-10": [{ text: "Reviewed the change with the team." }],
  },
  sections: sections(work),
  week: 1,
});

it("rejects a training period longer than the six NAITA months", () => {
  expect(() =>
    checkAllocation({
      trainingEnd: "2026-10-01",
      trainingStart: "2026-02-16",
    })
  ).toThrow(/2026-08-16/u);
  expect(
    checkAllocation({
      trainingEnd: "2026-08-16",
      trainingStart: "2026-02-16",
    })
  ).toMatchObject({ trainingEnd: "2026-08-16" });
  // A short training period is left alone.
  expect(
    checkAllocation({ trainingEnd: "2026-05-01", trainingStart: "2026-02-16" })
  ).toMatchObject({ trainingEnd: "2026-05-01" });
});

it("cuts a longer period to six months and archives the surplus weeks", async () => {
  context = fixture();
  const { repo, workspace } = context;
  // A workspace saved before the six-month rule existed still has to be
  // readable, so the long period is written straight into the profile.
  writeFileSync(
    paths(workspace).profile,
    JSON.stringify({
      ...PROFILE,
      trainingEnd: "2026-09-11",
      trainingStart: "2026-02-16",
    })
  );
  await execute("weeks", { workspace });
  const weeksDir = paths(workspace).weeks;
  // Week files and a screenshot folder from a period that used to be allowed.
  const surplus = path.join(weeksDir, "week-27-2026-08-17.json");
  writeFileSync(
    surplus,
    JSON.stringify({
      ...weekFile(workspace, 26),
      monday: "2026-08-17",
      number: 27,
    })
  );
  const surplusShots = path.join(
    paths(workspace).screenshots,
    "week-27-2026-08-17"
  );
  mkdirSync(surplusShots, { recursive: true });
  expect(existsSync(surplus)).toBe(true);
  seedRepo(repo);
  commit(repo, "2026-08-14T10:00:00", "fix: work inside the allocation");
  commit(repo, "2026-08-18T10:00:00", "fix: work after the allocation");
  await execute("import", { author: "trainee@example.test", repo, workspace });
  await execute("absence", { leave: "2026-08-17", medical: "", workspace });

  const result = await execute("allocation", {
    actor: "codex",
    reason: "six months only",
    workspace,
  });
  // Reading the diary moves a surplus week aside, so allocation only has to
  // cut the period; either way the week ends up in the archive.
  expect(result.archivedWeeks).not.toContain("week-27-2026-08-17.json");
  expect(result.end).toBe("2026-08-16");
  expect(loadProfile(workspace).trainingEnd).toBe("2026-08-16");

  const archive = path.join(
    paths(workspace).local,
    "archive",
    "beyond-training-allocation"
  );
  expect(existsSync(path.join(archive, "week-27-2026-08-17.json"))).toBe(true);
  expect(existsSync(path.join(archive, "week-27-2026-08-17"))).toBe(true);
  expect(
    readdirSync(weeksDir).filter((name) => name.endsWith(".json"))
  ).toHaveLength(26);
  expect(readJson(paths(workspace).state, null).absence.leave).toEqual([]);

  const diary = loadDiary(workspace);
  expect(diary.weeks).toHaveLength(26);
  // seedRepo also pushes a commit inside the period, so only the subjects that
  // fall after the allocation are checked here.
  const subjects = diary.weeks
    .flatMap((week) => week.days)
    .flatMap((day) => day.commits.map((item) => item.subject));
  expect(subjects).not.toContain("fix: work after the allocation");
  expect(subjects).toContain("fix: work inside the allocation");
  // A second run has nothing left to cut.
  const second = await execute("allocation", { workspace });
  expect(second.alreadyAllocated).toBe(true);
});

it("rewrites a whole week, refuses an incomplete week, and keeps the old points in the log", async () => {
  context = fixture();
  const { workspace } = context;
  await execute("weeks", { workspace });
  expect(weekFile(workspace, 1).sections.work).toEqual([]);
  const file = path.join(workspace, "week-1.json");
  const draft = weekDraft();
  // Week 1 has five working days, so a partial file must be refused.
  delete draft.days["2026-04-08"];
  writeFileSync(file, JSON.stringify(draft));
  await expect(
    execute("rewrite", { from: file, reason: "x", workspace })
  ).rejects.toThrow(/2026-04-08/u);
  expect(weekFile(workspace, 1).sections.work).toEqual([]);

  writeFileSync(file, JSON.stringify(weekDraft()));
  const result = await execute("rewrite", {
    actor: "codex",
    from: file,
    reason: "Descriptive wording for the week",
    workspace,
  });
  expect(result.week.sections.work[0].text).toBe(
    "Rebuilt the task list so it can be searched by title."
  );
  expect(result.week.days["2026-04-08"][0].source).toBe("manual");
  expect(result.week.reviewedFingerprint).toBeNull();

  const event = readHistory(workspace).findLast(
    (item) => item.action === "rewrite"
  );
  expect(event.reason).toBe("Descriptive wording for the week");
  const change = event.changes.find((item) =>
    item.path.includes("week-01-2026-04-06")
  );
  expect(change.before.value.sections.work).toEqual([]);
  expect(change.after.value.sections.work[0].text).toContain(
    "searched by title"
  );
  // A day entry is not a commit subject, and an unwritten day is not left blank.
  expect(change.after.value.days["2026-04-08"][0].text).toBe(
    "Sorted out why the filter did not apply."
  );
});
