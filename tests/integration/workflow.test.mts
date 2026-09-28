import {
  readFileSync,
  writeFileSync,
  existsSync,
  unlinkSync,
  readdirSync,
} from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { execute } from "../../src/cli/main.mts";
import { SECTIONS } from "../../src/diary/entries.mts";
import {
  loadDiary,
  readJson,
  saveProfile,
  paths,
} from "../../src/diary/store.mts";
import {
  fixture,
  seedRepo,
  cli,
  screenshot,
  PROFILE,
} from "../helpers/fixtures.mts";

let context;
afterEach(() => context?.cleanup());

it("can start with dates, add notes before import, and preserve CLI and manual edits on refresh", () => {
  context = fixture({
    trainingEnd: PROFILE.trainingEnd,
    trainingStart: PROFILE.trainingStart,
  });
  const { workspace, repo } = context;
  cli(workspace, "add", {
    section: "learning",
    text: "Learned how to reproduce a search issue.",
    week: "2",
  });
  seedRepo(repo);
  cli(workspace, "import", { leave: "", medical: "", repo });
  cli(workspace, "draft", { week: "1" });
  cli(workspace, "accept", { "accept-drafts": true, week: "1" });
  let week = cli(workspace, "show", { week: "1" });
  const last = week.entry.sections.work.at(-1).id;
  cli(workspace, "add", {
    before: last,
    section: "work",
    text: "Reviewed the empty state with my supervisor.",
    week: "1",
  });
  week = cli(workspace, "show", { week: "1" });
  expect(week.entry.sections.work[1].text).toContain("supervisor");
  const manual = readJson(week.file);
  manual.sections.work[0].text =
    "Added a task search box so users can find a task by title.";
  writeFileSync(week.file, JSON.stringify(manual, null, 2));
  const before = readFileSync(week.file, "utf-8");
  cli(workspace, "import", { repo });
  expect(readFileSync(week.file, "utf-8")).toBe(before);
  cli(workspace, "draft", { week: "1" });
  week = cli(workspace, "show", { week: "1" });
  expect(week.entry.sections.work).toEqual(manual.sections.work);
  expect(
    week.entry.suggestions.filter((item) => item.section === "work")
  ).toHaveLength(0);
  expect(
    cli(workspace, "show", { week: "2" }).entry.sections.learning
  ).toHaveLength(1);
  expect(existsSync(week.screenshotFolder)).toBe(true);
});

it("keeps a dry run read-only and refuses to guess absences in non-interactive mode", () => {
  context = fixture();
  seedRepo(context.repo);
  const location = paths(context.workspace);
  const before = readdirSync(location.local, { recursive: true });
  const result = cli(context.workspace, "generate", {
    "dry-run": true,
    repo: context.repo,
  });
  expect(result.weeks).toHaveLength(2);
  expect(result.state.commits).toHaveLength(3);
  expect(readdirSync(location.local, { recursive: true })).toEqual(before);
  expect(existsSync(location.state)).toBe(false);
  expect(() =>
    cli(context.workspace, "generate", { repo: context.repo })
  ).toThrow(/must be supplied/u);
  expect(existsSync(location.state)).toBe(false);
});

it("reports section/day/screenshot gaps, then invalidates review after manual edits or image changes", async () => {
  context = fixture({ ...PROFILE, trainingEnd: "2026-04-06" });
  const options = { workspace: context.workspace };
  await execute("absence", { ...options, leave: "", medical: "" });
  let status = await execute("status", options);
  expect(status.weeks[0]).toMatchObject({
    missingDays: ["2026-04-06"],
    percent: 0,
    reviewed: false,
  });
  for (const section of Object.keys(SECTIONS)) {
    // Each section is added in the declared order so the exported page order
    // is what this loop produces; running them together would be racy.
    // oxlint-disable-next-line no-await-in-loop
    await execute("add", {
      ...options,
      section,
      text: `My ${section} point.`,
      week: "1",
    });
  }
  await execute("add", {
    ...options,
    date: "2026-04-06",
    text: "Set up the local project.",
    week: "1",
  });
  const [week] = loadDiary(context.workspace).weeks;
  screenshot(week.screenshotFolder);
  status = await execute("status", options);
  expect(status.weeks[0]).toMatchObject({ complete: false, percent: 100 });
  await execute("review", { ...options, week: "1" });
  const reviewed = await execute("status", options);
  expect(reviewed.complete).toBe(true);
  const edited = readJson(week.file);
  edited.sections.learning[0].text = "Learned how the search filter works.";
  writeFileSync(week.file, JSON.stringify(edited));
  const afterEdit = await execute("status", options);
  expect(afterEdit.weeks[0].reviewed).toBe(false);
  await execute("review", { ...options, week: "1" });
  screenshot(week.screenshotFolder, "02-another.png");
  const afterScreenshot = await execute("status", options);
  expect(afterScreenshot.weeks[0].reviewed).toBe(false);
  await execute("review", { ...options, week: "1" });
  unlinkSync(path.join(week.screenshotFolder, "02-another.png"));
  const afterRemoval = await execute("status", options);
  expect(afterRemoval.weeks[0].reviewed).toBe(false);
  writeFileSync(
    path.join(week.screenshotFolder, "01-task-list.png"),
    "broken image"
  );
  status = await execute("status", options);
  expect(status.weeks[0].screenshots.errors).toHaveLength(1);
  expect(status.weeks[0].percent).toBeLessThan(100);
});

it("blocks work on leave dates and stale suggestions while preserving saved text", async () => {
  context = fixture();
  seedRepo(context.repo);
  const options = { workspace: context.workspace };
  await execute("import", {
    ...options,
    leave: "",
    medical: "",
    repo: context.repo,
  });
  await execute("draft", { ...options, week: "1" });
  await execute("absence", { ...options, leave: "2026-04-06" });
  const [week] = loadDiary(context.workspace).weeks;
  const leaveStatus = await execute("status", options);
  expect(leaveStatus.weeks[0].conflicts).toEqual(["2026-04-06"]);
  await expect(
    execute("accept", {
      ...options,
      id: week.entry.suggestions[0].id,
      week: "1",
    })
  ).rejects.toThrow(/no longer/u);
  await expect(
    execute("add", { ...options, date: "2026-04-06", text: "Work.", week: "1" })
  ).rejects.toThrow(/work date/u);
});

it("adds daily notes alongside the existing Git description and lets the student edit it", async () => {
  context = fixture();
  seedRepo(context.repo);
  const options = { workspace: context.workspace };
  await execute("import", { ...options, repo: context.repo });
  await execute("add", {
    ...options,
    date: "2026-04-06",
    text: "Also reviewed feedback on the search box.",
    week: "1",
  });
  const [week] = loadDiary(context.workspace).weeks;
  expect(week.entry.days["2026-04-06"]).toHaveLength(2);
  await execute("edit", {
    ...options,
    date: "2026-04-06",
    id: week.entry.days["2026-04-06"][0].id,
    text: "Added a search box to help users find tasks.",
    week: "1",
  });
  expect(
    loadDiary(context.workspace).weeks[0].entry.days["2026-04-06"][0].source
  ).toBe("manual");
});

it("fails clearly on malformed manual files and prevents calendar changes from losing weeks", async () => {
  context = fixture();
  await execute("weeks", { workspace: context.workspace });
  expect(() =>
    saveProfile(context.workspace, { ...PROFILE, trainingStart: "2026-04-07" })
  ).toThrow(/separate|another/u);
  const [week] = loadDiary(context.workspace).weeks;
  writeFileSync(week.file, "{bad json");
  await expect(
    execute("status", { workspace: context.workspace })
  ).rejects.toThrow(/Cannot read/u);
  expect(readFileSync(week.file, "utf-8")).toBe("{bad json");
});

it("imports reviewed agent proposals without changing existing notes and rejects partial invalid responses", async () => {
  context = fixture();
  seedRepo(context.repo);
  const options = { workspace: context.workspace };
  await execute("import", { ...options, repo: context.repo });
  await execute("add", {
    ...options,
    section: "work",
    text: "My own wording.",
    week: "1",
  });
  const diary = loadDiary(context.workspace);
  const file = path.join(context.root, "response.json");
  const response = {
    weeks: [
      {
        monday: diary.weeks[0].monday,
        suggestions: [
          {
            evidence: [diary.state.commits[0].hash],
            kind: "draft",
            reason: "The commit describes this.",
            section: "work",
            text: "Added a task search box.",
          },
        ],
      },
    ],
  };
  writeFileSync(file, JSON.stringify(response));
  await execute("draft", { ...options, from: file, week: "1" });
  expect(
    loadDiary(context.workspace).weeks[0].entry.sections.work[0].text
  ).toBe("My own wording.");
  const saved = readFileSync(diary.weeks[0].file, "utf-8");
  response.weeks.push({ monday: "2030-01-01", suggestions: [] });
  writeFileSync(file, JSON.stringify(response));
  await expect(execute("draft", { ...options, from: file })).rejects.toThrow(
    /unknown/u
  );
  expect(readFileSync(diary.weeks[0].file, "utf-8")).toBe(saved);
});
