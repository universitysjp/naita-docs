import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
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
    "Built a screen so a user can find a record by name.",
    "Fixed a defect in the release checklist that failed on staging.",
  ],
};

/** Every profile field, so the report has no blank identity field left. */
const FULL_PROFILE = {
  category: "Undergraduate",
  course: "Bachelor of Information Technology",
  department: "Department of Computing",
  establishment: "Example Software Team",
  faculty: "Faculty of Technology",
  field: "Information and Communication Technology",
  institute: "Example Institute",
  instituteRegistration: "ICT/TEST/001",
  naitaRegistration: "TEST/001",
  name: "Sample Trainee",
  phone: "011 123 4567",
  privateAddress: "12 Sample Road, Colombo",
  studentNumber: "IT/00/0001",
  supervisor: "S. Supervisor",
  supervisorDesignation: "Team Leader",
  teamLead: "T. Lead",
  trainingEnd: "2026-04-17",
  trainingLocation: "Colombo office",
  trainingStart: "2026-04-06",
};

const CONTENT_FILES = [
  [
    "front-matter/acknowledgement.md",
    "I thank the authority and my supervisor.",
  ],
  ["front-matter/preface.md", "This report covers the industrial training."],
  ["front-matter/abbreviations.md", "API - Application Programming Interface"],
  [
    "back-matter/references.md",
    "Example Publisher, Example Guide, 2026, https://example.test",
  ],
  [
    "chapters/01-organization/nature-of-business.md",
    "The establishment builds software.",
  ],
  [
    "chapters/01-organization/organisation-structure.md",
    "The team has a lead and three engineers.",
  ],
  [
    "chapters/01-organization/management-practices.md",
    "Work is planned in two-week cycles.",
  ],
  [
    "chapters/02-training-experience/placement-introduction.md",
    "I joined the engineering team.",
  ],
  [
    "chapters/02-training-experience/learning-period.md",
    "I read the existing service first.",
  ],
  [
    "chapters/02-training-experience/events.md",
    "I attended the internship day.",
  ],
  [
    "chapters/03-conclusion/conclusion.md",
    "The training produced a working feature.",
  ],
  ["chapters/03-conclusion/strengths.md", "I finish what I start."],
  ["chapters/03-conclusion/weaknesses.md", "I estimate too early."],
  [
    "chapters/03-conclusion/opportunities.md",
    "I can take on the reporting work.",
  ],
  ["chapters/03-conclusion/threats.md", "The requirements can change late."],
  ["chapters/03-conclusion/suggestions.md", "A second reviewer would help."],
];

/** Writes every section the report reads, so no section stays a placeholder. */
const writeReportContent = (workspace) => {
  for (const [name, text] of CONTENT_FILES) {
    const file = path.join(workspace, "local/report/content", name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, `${text}\n`);
  }
};

const writeCompanyRecord = (workspace) => {
  const file = companyPath(workspace);
  mkdirSync(path.dirname(file), { recursive: true });
  writeFileSync(
    file,
    JSON.stringify({
      file,
      name: "Example Software Team",
      record: {
        address: {
          source: "https://example.test/about",
          value: "1 Example Road",
        },
      },
      researchedAt: "2026-04-06T00:00:00.000Z",
      sources: ["https://example.test/about"],
    })
  );
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

it("keeps repository language out of the PDF and reports it instead", async () => {
  context = fixture();
  const { workspace } = context;
  const diary = loadDiary(workspace);
  const [week] = diary.weeks;
  week.entry.sections.work.push(
    point(
      "Updated src/services/vacancy.ts and pushed a PR to the develop branch."
    ),
    point(
      "Added a vacancy stepper so a recruiter can move a card between stages."
    )
  );
  saveWeek(workspace, week);

  const result = await execute("report", {
    out: path.join(context.root, "language.pdf"),
    workspace,
  });

  const languagePages = await pdfPages(path.join(context.root, "language.pdf"));
  const all = languagePages.map((page) => page.text).join(" ");
  expect(all).not.toMatch(/src\/services/iu);
  expect(all).not.toMatch(/\bpull request\b|\bPR\b|develop branch/iu);
  // The real outcome in the same week survives.
  expect(all).toContain("vacancy stepper");
  // And the student is told exactly what was held back.
  expect(result.warnings.join(" ")).toContain("repository language");
  expect(result.missing.repositoryLanguage.length).toBe(1);
  // A report holding repository language back is never reported as ready.
  expect(result.complete).toBe(false);
});

it("reports a fully supplied workspace as complete", async () => {
  // Guards the completion signal: a constant "missing" input would make
  // `complete` unreachable no matter how complete the workspace is.
  context = fixture();
  const { workspace } = context;

  for (const [field, text] of Object.entries(FULL_PROFILE)) {
    // oxlint-disable-next-line no-await-in-loop -- each field is saved and reloaded before the next
    await execute("profile", { field, text, workspace });
  }
  await execute("absence", { leave: "", medical: "", workspace });

  for (const week of loadDiary(workspace).weeks) {
    for (const section of Object.keys(SECTIONS)) {
      // oxlint-disable-next-line no-await-in-loop -- each point is appended to the same week file in order
      await execute("add", {
        section,
        text: `Recorded ${section} work for week ${week.number}.`,
        week: String(week.number),
        workspace,
      });
    }
    for (const day of week.days) {
      if (day.status === "work") {
        // oxlint-disable-next-line no-await-in-loop -- each note is appended to the same week file in date order
        await execute("add", {
          date: day.date,
          text: `Worked on the reporting task on ${day.date}.`,
          week: String(week.number),
          workspace,
        });
      }
    }
    screenshot(week.screenshotFolder);
    // oxlint-disable-next-line no-await-in-loop -- the review fingerprint covers everything written above
    await execute("review", { week: String(week.number), workspace });
  }

  writeReportContent(workspace);
  writeCompanyRecord(workspace);

  const result = await execute("report", {
    out: path.join(context.root, "complete.pdf"),
    workspace,
  });
  expect(result.missing.reportInputs).toEqual([]);
  expect(result.missing.assets.pending).toBe(0);
  expect(result.missing.repositoryLanguage).toEqual([]);
  expect(result.complete).toBe(true);
});

it("warns when a referenced event photograph is not on disk", async () => {
  context = fixture();
  const { workspace } = context;
  const events = path.join(
    workspace,
    "local/report/content/chapters/02-training-experience/events.md"
  );
  mkdirSync(path.dirname(events), { recursive: true });
  writeFileSync(
    events,
    "## Internship Day\n\nPresented the work.\n\n![Absent](never-placed.png)\n"
  );

  const result = await execute("report", {
    out: path.join(context.root, "events.pdf"),
    workspace,
  });
  expect(result.warnings.join(" ")).toContain("never-placed.png");
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
  expect(all).toContain("Built a screen so a user can find a record by name.");
  // The stream heading is derived from the generic stream list, not from any
  // one placement's product vocabulary.
  expect(all).toContain("2.3.1 Building the Work");

  // The week's screenshot sits in the stream section, before the next one.
  const flow = pages.flatMap((page) =>
    page.items.map((item) => item.str.trim())
  );
  const firstStream = flow.findIndex((text) =>
    text.startsWith("2.3.1 Building the Work")
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
  expect(all).toContain("No company research has been saved");
  expect(all).toContain(
    "This section is not written yet. It covers what the establishment does"
  );
  // A blank identity field is shown as a question, never dropped from the cover.
  expect(all).toContain("[NOT RECORDED]");
});
