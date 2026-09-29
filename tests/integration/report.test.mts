import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { execute } from "../../src/cli/main.mts";
import { point, SECTIONS } from "../../src/diary/entries.mts";
import { loadDiary, saveWeek } from "../../src/diary/store.mts";
import { companyPath } from "../../src/report/company.mts";
import { fixture, screenshot, seedRepo } from "../helpers/fixtures.mts";
import { pdfPages } from "../helpers/pdf.mts";

let context;
afterEach(() => context?.cleanup());

const POINTS = {
  improvements: ["Write down the empty-input case before changing the filter."],
  learning: ["Learned to check the empty case as well as the matching case."],
  problems: ["The filtered list stayed empty after the search was cleared."],
  solutions: ["Reloaded through the same path as the search."],
  work: [
    "Added a search box to the task list.",
    "Fixed the document export footer.",
  ],
};

/** Fills every week of a fixture workspace so the report has real evidence. */
const seedWorkspace = (workspace) => {
  const diary = loadDiary(workspace);
  for (const week of diary.weeks) {
    for (const section of Object.keys(SECTIONS)) {
      for (const text of POINTS[section]) {
        week.entry.sections[section].push(point(text));
      }
    }
    for (const day of week.days) {
      if (day.status === "work") {
        week.entry.days[day.date].push(point("Worked on the task list."));
      }
    }
    screenshot(week.screenshotFolder);
    week.entry.screenshots.captions["01-task-list.png"] =
      `Week ${week.number}: task list after the change`;
    saveWeek(workspace, week);
  }
  return diary;
};

it("stores only sourced company findings and reports the rest as questions", async () => {
  context = fixture();
  seedRepo(context.repo);
  const { workspace } = context;
  await execute("import", {
    leave: "",
    medical: "",
    repo: context.repo,
    workspace,
  });
  const file = path.join(context.root, "company.json");
  writeFileSync(
    file,
    JSON.stringify({
      findings: [
        {
          key: "name",
          url: "https://example.test/about",
          value: "Example Software Team",
        },
        {
          key: "industry",
          url: "https://example.test/about",
          value: "Software services",
        },
        // No public source: this one must be dropped, not stored.
        { key: "employees", url: "not-a-url", value: "120" },
        // Unknown field: also dropped, so the record cannot grow freely.
        { key: "profits", url: "https://example.test", value: "large" },
      ],
    })
  );
  const result = await execute("company", { from: file, workspace });
  const { fields, warnings } = result;
  expect(fields.map((field) => field.key)).toEqual(["name", "industry"]);
  expect(warnings).toHaveLength(2);
  expect(warnings.join(" ")).toContain("no public source URL");
  expect(warnings.join(" ")).toContain("not a known field");
  // Everything the research could not confirm is listed for the student.
  expect(result.missing.map((item) => item.key)).toContain("employees");
  expect(result.missing.map((item) => item.key)).toContain("vision");

  // The stored record keeps the source beside every value.
  const stored = JSON.parse(readFileSync(companyPath(workspace), "utf-8"));
  expect(stored.record.name).toEqual({
    source: "https://example.test/about",
    value: "Example Software Team",
  });
  expect(stored.record.employees).toBeUndefined();
  // The source list is deduplicated: two fields from one page cite it once.
  expect(stored.sources).toEqual(["https://example.test/about"]);
});

it("reports no company research rather than inventing establishment facts", async () => {
  context = fixture();
  const result = await execute("company", { workspace: context.workspace });
  expect(result.fields).toEqual([]);
  expect(result.message).toContain("No company research saved");
  await expect(
    execute("company", { name: "Acme Inc", workspace: context.workspace })
  ).rejects.toThrow(/--agent/u);
});

it("builds the report from the diary, with figures inside their work stream", async () => {
  context = fixture();
  seedRepo(context.repo);
  const { workspace } = context;
  await execute("import", {
    leave: "",
    medical: "",
    repo: context.repo,
    workspace,
  });
  seedWorkspace(workspace);
  const out = path.join(context.root, "report.pdf");
  const result = await execute("report", { out, workspace });

  expect(result.pages).toBeGreaterThan(4);
  // Both weeks contributed a screenshot, so the report carries figures.
  expect(result.figures).toBeGreaterThanOrEqual(2);
  expect(result.tables).toBeGreaterThanOrEqual(1);
  // An incomplete workspace must not be reported as ready.
  expect(result.complete).toBe(false);
  expect(result.missing.incompleteWeeks.length).toBeGreaterThan(0);

  const pages = await pdfPages(out);
  const all = pages.map((page) => page.text).join(" ");

  for (const heading of [
    "TABLE OF CONTENTS",
    "LIST OF FIGURES",
    "Chapter 1: Training Organization",
    "Chapter 2: Training Experience",
    "Chapter 3: Conclusion",
    "Supervisor Certification",
  ]) {
    expect(all, `missing ${heading}`).toContain(heading);
  }
  // Diary wording reaches the report, and the numbering is derived from the tree.
  expect(all).toContain("Added a search box to the task list.");
  expect(all).toContain("2.3.1 Interface and Design System");

  // The week's screenshot sits in the stream section, before the next one.
  const flow = pages.flatMap((page) =>
    page.items.map((item) => item.str.trim())
  );
  const firstStream = flow.findIndex((text) =>
    text.startsWith("2.3.1 Interface and Design System")
  );
  const firstFigure = flow.findIndex((text) => text.startsWith("Figure 1:"));
  expect(firstStream).toBeGreaterThan(0);
  expect(firstFigure).toBeGreaterThan(firstStream);

  // The work chart is built from the diary's own point counts, not invented.
  expect(all).toContain("Recorded work points per work stream");

  // Nothing a report may never claim is printed.
  expect(all).not.toMatch(/all tests pass/iu);
  expect(all).not.toMatch(/\bcommit\b/iu);
  expect(all).not.toMatch(/\bpull request\b/iu);
});

it("keeps the establishment's address and the placement location on separate cover lines", async () => {
  context = fixture();
  seedRepo(context.repo);
  const { workspace } = context;
  await execute("import", {
    leave: "",
    medical: "",
    repo: context.repo,
    workspace,
  });
  seedWorkspace(workspace);
  // The profile records the placement location but no establishment address, so
  // the cover must not print the same value in both places.
  const out = path.join(context.root, "cover.pdf");
  await execute("report", { out, workspace });
  const pages = await pdfPages(out);
  const cover = pages[0].text.replaceAll("Colombo office", "|");
  expect(cover).not.toContain("||");
});

it("writes a visible question instead of a filled-in fact when research is missing", async () => {
  context = fixture();
  seedRepo(context.repo);
  const { workspace } = context;
  await execute("import", {
    leave: "",
    medical: "",
    repo: context.repo,
    workspace,
  });
  seedWorkspace(workspace);
  const out = path.join(context.root, "missing.pdf");
  await execute("report", { out, workspace });
  const pages = await pdfPages(out);
  const all = pages.map((page) => page.text).join(" ");
  expect(all).toContain("No company research has been saved yet");
  expect(all).toContain("Add the nature of the business here");
});
