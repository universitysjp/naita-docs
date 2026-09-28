import { execFileSync } from "node:child_process";
import {
  existsSync,
  readFileSync,
  readdirSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { execute } from "../../src/cli/main.mts";
import { formatChecklist } from "../../src/diary/checklist.mts";
import { paths, loadDiary } from "../../src/diary/store.mts";
import {
  fixture,
  PROFILE,
  ROOT,
  commit,
  git,
  screenshot,
  cli,
} from "../helpers/fixtures.mts";

let context;
afterEach(() => context?.cleanup());
const saved = (workspace) =>
  JSON.parse(readFileSync(paths(workspace).checklistJson, "utf-8"));
const done = (plan, id) => plan.tasks.find((item) => item.id === id).done;

it("creates a saved checklist during init, then creates week folders when dates are supplied", async () => {
  context = fixture();
  const workspace = path.join(context.root, "new trainee");
  let plan = await execute("checklist", { workspace });
  expect(plan.weeks).toEqual([]);
  expect(done(plan, "profile")).toBe(false);
  expect(existsSync(paths(workspace).checklist)).toBe(true);
  await execute("init", {
    from: path.join(ROOT, "docs/examples/profile.json"),
    workspace,
  });
  plan = saved(workspace);
  expect(plan.weeks).toHaveLength(2);
  expect(plan.tasks.map((item) => item.id)).toEqual([
    "profile",
    "attendance",
    "evidence",
    "writing",
    "screenshots",
    "review",
    "export",
  ]);
  expect(done(plan, "profile")).toBe(true);
  expect(done(plan, "screenshots")).toBe(false);
  for (const week of plan.weeks) {
    expect(week.ideas).toEqual([]);
    expect(readdirSync(week.folder)).toEqual([]);
  }
  git(workspace, ["init", "-q"]);
  expect(
    git(workspace, ["status", "--porcelain", "--untracked-files=all"])
  ).toBe("");
});

it("prints capture ideas after import and reuses the multi-repo cache for the correct weeks offline", async () => {
  context = fixture();
  const { workspace, repo } = context;
  const first = commit(repo, "2026-04-06T09:00:00Z", "feat: add task search");
  const tests = commit(
    repo,
    "2026-04-13T09:00:00Z",
    "test: add filtering checks"
  );
  const output = execFileSync(
    "bun",
    [
      "run",
      path.join(ROOT, "src/cli.mts"),
      "import",
      "--workspace",
      workspace,
      "--repo",
      repo,
    ],
    { encoding: "utf-8" }
  );
  expect(output).toContain("Diary checklist — screenshots last");
  expect(output).toContain(loadDiary(workspace).weeks[0].screenshotFolder);
  expect(output).toContain("search/filter input");
  const backend = path.join(context.root, "second repo");
  git(context.root, ["clone", "-q", repo, backend]);
  const api = commit(
    backend,
    "2026-04-07T09:00:00Z",
    "feat(api): return a filtered response"
  );
  await execute("import", { repo: backend, workspace });
  renameSync(repo, `${repo}-offline`);
  renameSync(backend, `${backend}-offline`);
  const plan = cli(workspace, "checklist");
  expect(plan.weeks[0].ideas.flatMap((idea) => idea.evidence)).toEqual([
    first,
    api,
  ]);
  expect(plan.weeks[0].ideas[0].repos).toEqual([repo, backend]);
  expect(plan.weeks[1].ideas[0].evidence).toEqual([tests]);
  expect(plan.weeks[1].ideas[0].capture).toContain("actual result");
  expect(plan.weeks[0].ideas[1].capture).toContain("request and its response");
  for (const week of plan.weeks) {
    for (const idea of week.ideas) {
      expect(path.dirname(idea.path)).toBe(week.folder);
      expect(path.isAbsolute(idea.path)).toBe(true);
      expect(path.relative(week.folder, idea.path)).toBe(idea.filename);
      expect(idea.filename).toMatch(/^[a-z0-9-]+\.png$/u);
      expect(idea.optional).toBe(true);
    }
  }
  const selected = await execute("checklist", { week: "2", workspace });
  expect(selected.weeks.map((week) => week.number)).toEqual([2]);
  expect(saved(workspace).weeks).toHaveLength(2);
  const reportBefore = readFileSync(paths(workspace).checklist);
  await execute("checklist", { workspace });
  expect(readFileSync(paths(workspace).checklist)).toEqual(reportBefore);
});

it("refreshes manual capture ideas, excludes leave-date commits, and leaves screenshots for last", async () => {
  context = fixture({ ...PROFILE, trainingEnd: "2026-04-10" });
  const { workspace, repo } = context;
  const work = commit(
    repo,
    "2026-04-06T09:00:00Z",
    "feat: add the search screen"
  );
  const onLeave = commit(
    repo,
    "2026-04-07T09:00:00Z",
    "feat: unavailable-day change"
  );
  await execute("import", {
    leave: "2026-04-07",
    medical: "",
    off: "2026-04-08..2026-04-10",
    repo,
    workspace,
  });
  await execute("add", {
    section: "work",
    text: "Reviewed a design document with my supervisor.",
    week: "1",
    workspace,
  });
  for (const section of ["problems", "solutions", "learning", "improvements"]) {
    // Each add must be persisted before the next one so the checklist state
    // transitions are exercised in order.
    // oxlint-disable-next-line no-await-in-loop
    await execute("add", {
      section,
      text: `Student-supplied ${section} note.`,
      week: "1",
      workspace,
    });
  }
  let plan = saved(workspace);
  expect(plan.weeks[0].ideas.flatMap((idea) => idea.evidence)).toContain(work);
  expect(plan.weeks[0].ideas.flatMap((idea) => idea.evidence)).not.toContain(
    onLeave
  );
  expect(
    plan.weeks[0].ideas.find((idea) => idea.source === "manual")
  ).toMatchObject({
    capture: expect.stringContaining("document"),
    dates: [],
    evidence: [],
  });
  expect(done(plan, "screenshots")).toBe(false);
  // attendance conflict is unresolved
  expect(done(plan, "writing")).toBe(false);
  const [week] = loadDiary(workspace).weeks;
  week.entry.sections.work[0].text = "Reviewed the updated API design.";
  writeFileSync(week.file, JSON.stringify(week.entry));
  const jsonBeforeDryRun = readFileSync(paths(workspace).checklistJson);
  const markdownBeforeDryRun = readFileSync(paths(workspace).checklist);
  await execute("generate", { "dry-run": true, workspace });
  expect(readFileSync(paths(workspace).checklistJson)).toEqual(
    jsonBeforeDryRun
  );
  expect(readFileSync(paths(workspace).checklist)).toEqual(
    markdownBeforeDryRun
  );
  await execute("status", { workspace });
  plan = saved(workspace);
  expect(
    plan.weeks[0].ideas.find((idea) => idea.source === "manual").activity
  ).toContain("updated API design");
  screenshot(week.screenshotFolder, "student-chosen-name.png");
  await execute("screenshots", { week: "1", workspace });
  plan = saved(workspace);
  expect(done(plan, "screenshots")).toBe(true);
  expect(done(plan, "review")).toBe(false);
  expect(formatChecklist(plan, { markdown: false })).toContain(
    "student-chosen-name.png"
  );
  writeFileSync(path.join(week.screenshotFolder, "broken.png"), "not an image");
  await execute("status", { workspace });
  expect(done(saved(workspace), "screenshots")).toBe(false);
});

it("allows writing and draft export before screenshots, but only completes the checklist after a current final export", async () => {
  context = fixture({ ...PROFILE, trainingEnd: PROFILE.trainingStart });
  const { workspace } = context;
  await execute("absence", { leave: "", medical: "", workspace });
  await execute("add", {
    date: PROFILE.trainingStart,
    text: "Prepared a design document.",
    week: "1",
    workspace,
  });
  for (const section of [
    "work",
    "problems",
    "solutions",
    "learning",
    "improvements",
  ]) {
    // Sequential on purpose: each add appends a point whose id the next step
    // depends on, and the exported PDF must show them in this order.
    // oxlint-disable-next-line no-await-in-loop
    await execute("add", {
      section,
      text: `Student-supplied ${section} note.`,
      week: "1",
      workspace,
    });
  }
  expect(done(saved(workspace), "writing")).toBe(true);
  expect(done(saved(workspace), "screenshots")).toBe(false);
  await execute("generate", { workspace });
  expect(done(saved(workspace), "export")).toBe(false);
  await execute("screenshots", {
    reason: "No shareable visual evidence for this documentation work.",
    week: "1",
    workspace,
  });
  await execute("review", { week: "1", workspace });
  await execute("generate", { strict: true, workspace });
  expect(saved(workspace).complete).toBe(true);
  expect(saved(workspace).tasks.every((task) => task.done)).toBe(true);
  await execute("add", {
    section: "work",
    text: "Added a clarification.",
    week: "1",
    workspace,
  });
  expect(done(saved(workspace), "export")).toBe(false);
});

it("escapes untrusted Markdown, uses safe suggested filenames, and never logs the derived reports as student edits", async () => {
  context = fixture();
  const { workspace, repo } = context;
  commit(
    repo,
    "2026-04-06T09:00:00Z",
    "docs: add <script> [link](https://example.invalid) `file` ../../escape"
  );
  await execute("import", { repo, workspace });
  const plan = saved(workspace);
  const markdown = readFileSync(paths(workspace).checklist, "utf-8");
  expect(markdown).not.toContain("<script>");
  expect(markdown).toContain("&lt;script&gt;");
  expect(markdown).toContain("\\[link\\]");
  expect(path.dirname(plan.weeks[0].ideas[0].path)).toBe(plan.weeks[0].folder);
  const historyBefore = readFileSync(paths(workspace).journal);
  await execute("checklist", { workspace });
  expect(readFileSync(paths(workspace).journal)).toEqual(historyBefore);
});
