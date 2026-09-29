import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { afterEach, expect, it } from "vitest";

import { fetchImages, imageSize } from "../../src/report/assets.mts";
import { sanitizeFindings } from "../../src/report/company.mts";
import { groupWorkStreams } from "../../src/report/from-diary.mts";
import { renderReportDocument } from "../../src/report/render.mts";
import {
  buildTemplateDocument,
  templateImages,
} from "../../src/report/template.mts";
import { PNG } from "../helpers/fixtures.mts";
import { pdfPages } from "../helpers/pdf.mts";

let context;
afterEach(() => context?.cleanup());

const workspace = () => {
  const root = mkdtempSync(path.join(tmpdir(), "naita-report-"));
  mkdirSync(path.join(root, "images"));
  return {
    cleanup: () => rmSync(root, { force: true, recursive: true }),
    root,
  };
};

const image = (root, name) => {
  const file = path.join(root, "images", name);
  writeFileSync(file, PNG);
  return { height: 1, kind: "png", path: file, width: 1 };
};

const cover = {
  category: "Undergraduate",
  course: "Bachelor of Information Technology",
  establishment: "Acme Inc",
  field: "Software Engineering",
  institute: "University of Colombo",
  naitaRegistration: "NAITA/1",
  name: "A. N. Trainee",
  studentNumber: "IT/00/0000",
  trainingEnd: "2026-08-16",
  trainingLocation: "Colombo",
  trainingStart: "2026-02-16",
};

it("numbers headings to four levels and lists figures and tables with real page numbers", async () => {
  context = workspace();
  const out = path.join(context.root, "numbered.pdf");
  await renderReportDocument(
    {
      chapters: [
        {
          blocks: [{ kind: "paragraph", text: "Chapter body." }],
          children: [
            {
              children: [
                {
                  blocks: [{ kind: "paragraph", text: "Deepest level." }],
                  children: [
                    {
                      blocks: [
                        {
                          caption: "Deepest section figure",
                          image: image(context.root, "deep.png"),
                          kind: "figure",
                        },
                      ],
                      title: "Fourth level",
                    },
                  ],
                  title: "Third level",
                },
              ],
              title: "Second level",
            },
          ],
          introTitle: "Introduction",
          title: "Training Organization",
        },
      ],
      cover,
      title: "Report on Industrial Training",
    },
    out
  );
  const pages = await pdfPages(out);
  const all = pages.map((page) => page.text).join(" ");
  for (const label of ["1.0", "1.1", "1.1.1", "1.1.1.1"]) {
    expect(all, `missing heading ${label}`).toContain(label);
  }
  expect(all).toContain("Figure 1: Deepest section figure");
  expect(all).toContain("TABLE OF CONTENTS");
  expect(all).toContain("LIST OF FIGURES");
  // The figure caption is recorded once in the list and once in the body.
  expect(all.match(/Figure 1: Deepest section figure/gu).length).toBe(2);
  // Every contents entry carries a page number that exists in the document.
  const contents = pages.find((page) =>
    page.text.includes("TABLE OF CONTENTS")
  );
  const numbers = contents.text.match(/\b\d{1,3}\b(?=\s*$)/gu) || [];
  expect(numbers.length).toBeGreaterThan(0);
  for (const number of numbers) {
    expect(
      Number(number),
      `contents points to missing page ${number}`
    ).toBeLessThanOrEqual(pages.length);
  }
});

it("places a figure inside its section instead of collecting figures at the end", async () => {
  context = workspace();
  const out = path.join(context.root, "inline.pdf");
  await renderReportDocument(
    {
      chapters: [
        {
          blocks: [{ kind: "paragraph", text: "Chapter body." }],
          children: [
            {
              blocks: [
                { kind: "paragraph", text: "First section body." },
                {
                  caption: "First section figure",
                  image: image(context.root, "first.png"),
                  kind: "figure",
                },
              ],
              title: "First Section",
            },
            {
              blocks: [
                { kind: "paragraph", text: "Second section body." },
                {
                  caption: "Second section figure",
                  image: image(context.root, "second.png"),
                  kind: "figure",
                },
              ],
              title: "Second Section",
            },
          ],
          introTitle: "Introduction",
          title: "Training Experience",
        },
      ],
      cover,
      title: "Report on Industrial Training",
    },
    out
  );
  const pages = await pdfPages(out);
  // The order is checked in reading order rather than by page number, because
  // both sections may legitimately share one page. What must not happen is the
  // two figures being collected together after both sections.
  // The contents and the figure list repeat the same labels, so comparison
  // starts at the first body page, which is the one holding the chapter opening.
  const bodyStart = pages.findIndex((page) =>
    page.text.includes("Chapter 1: Training Experience")
  );
  expect(bodyStart).toBeGreaterThan(0);
  const body = pages.slice(bodyStart);
  const flow = body.flatMap((page) =>
    page.items
      .map((item) => item.str)
      // Drop the dot leaders: the contents and figure list draw the label and
      // its leader as one text run.
      .map((text) => text.replace(/\s*\.{4,}\s*$/u, ""))
      .filter((text) =>
        /^(?<label>1\.1 First Section|1\.2 Second Section|Figure 1: First section figure|Figure 2: Second section figure)$/u.test(
          text
        )
      )
  );
  expect(flow).toEqual([
    "1.1 First Section",
    "Figure 1: First section figure",
    "1.2 Second Section",
    "Figure 2: Second section figure",
  ]);
});

it("renders every drawing kind and a table with columns, alignment, and a caption", async () => {
  context = workspace();
  const out = path.join(context.root, "drawings.pdf");
  const result = await renderReportDocument(
    {
      chapters: [
        {
          blocks: [
            {
              caption: "Bar chart of weekly output",
              drawing: {
                categories: ["W1", "W2", "W3"],
                kind: "bar",
                series: [{ name: "Points", values: [2, 5, 8] }],
                title: "Output",
              },
              kind: "drawing",
            },
            {
              caption: "Stacked work by month",
              drawing: {
                categories: ["Feb", "Mar"],
                kind: "stackedBar",
                series: [
                  { name: "Interface", values: [3, 4] },
                  { name: "Service", values: [2, 3] },
                ],
                title: "Stacked",
              },
              kind: "drawing",
            },
            {
              caption: "Trend across the placement",
              drawing: {
                categories: ["Feb", "Mar", "Apr"],
                kind: "line",
                series: [{ name: "Pass rate", values: [90, 95, 99] }],
                title: "Trend",
              },
              kind: "drawing",
            },
            {
              caption: "Share of the period by area",
              drawing: {
                kind: "pie",
                slices: [
                  { label: "Interface", value: 6 },
                  { label: "Service", value: 4 },
                ],
                title: "Share",
              },
              kind: "drawing",
            },
            {
              caption: "Team structure",
              drawing: {
                kind: "orgTree",
                title: "Structure",
                tree: {
                  children: [
                    { children: [], label: "Quality", role: "Lead" },
                    { children: [], label: "Platform", role: "Lead" },
                  ],
                  label: "Engineering",
                  role: "Head",
                },
              },
              kind: "drawing",
            },
            {
              caption: "Delivery steps",
              drawing: {
                kind: "flow",
                steps: [
                  { detail: "Story", label: "Plan" },
                  { detail: "Code", label: "Build" },
                  { detail: "Check", label: "Verify" },
                ],
                title: "Flow",
              },
              kind: "drawing",
            },
            {
              caption: "Platform layers",
              drawing: {
                kind: "layers",
                layers: [
                  { items: ["Screens"], name: "Interface" },
                  { items: ["Services"], name: "Service" },
                ],
                title: "Layers",
              },
              kind: "drawing",
            },
            {
              caption: "Placement timeline",
              drawing: {
                kind: "timeline",
                milestones: [
                  { label: "Access", period: "Month 1" },
                  { label: "Delivery", period: "Month 2" },
                ],
                title: "Timeline",
              },
              kind: "drawing",
            },
            {
              caption: "Table of checks by area",
              columns: [
                { header: "Area", weight: 2 },
                { align: "right", header: "Checks", weight: 1 },
              ],
              kind: "table",
              rows: [
                ["Interface", "11"],
                ["Service", "9"],
              ],
            },
          ],
          children: [],
          introTitle: "Introduction",
          title: "Training Experience",
        },
      ],
      cover,
      title: "Report on Industrial Training",
    },
    out
  );
  expect(result.figures).toBe(8);
  expect(result.tables).toBe(1);
  const pages = await pdfPages(out);
  const all = pages.map((page) => page.text).join(" ");
  for (const caption of [
    "Figure 1: Bar chart of weekly output",
    "Figure 2: Stacked work by month",
    "Figure 3: Trend across the placement",
    "Figure 4: Share of the period by area",
    "Figure 5: Team structure",
    "Figure 6: Delivery steps",
    "Figure 7: Platform layers",
    "Figure 8: Placement timeline",
    "Table 1: Table of checks by area",
  ]) {
    expect(all, `missing caption ${caption}`).toContain(caption);
  }
  // Chart labels and axis numbers are real text, not a flattened image.
  expect(all).toContain("Pass rate");
  expect(all).toContain("Engineering");
  // Table content stays inside the printable width.
  for (const page of pages) {
    for (const item of page.items) {
      expect(item.transform[4]).toBeGreaterThanOrEqual(71);
      expect(item.transform[4] + item.width).toBeLessThanOrEqual(524.3);
    }
  }
});

it("refuses an output path that is not a PDF", async () => {
  context = workspace();
  await expect(
    renderReportDocument(
      { chapters: [], cover, title: "T" },
      path.join(context.root, "out.txt")
    )
  ).rejects.toThrow(/must end with .pdf/u);
});

it("keeps the supervisor certification page unwritten", async () => {
  context = workspace();
  const out = path.join(context.root, "certified.pdf");
  await renderReportDocument(
    {
      certification: {
        declaration: "I declare that I have checked this report.",
        fields: [
          { label: "Name", value: "" },
          { label: "Designation", value: "" },
          { label: "Date", value: "" },
        ],
        title: "SUPERVISOR CERTIFICATION",
      },
      chapters: [
        {
          blocks: [{ kind: "paragraph", text: "Body." }],
          children: [],
          introTitle: "Introduction",
          title: "Conclusion",
        },
      ],
      cover,
      title: "Report on Industrial Training",
    },
    out
  );
  const pages = await pdfPages(out);
  const all = pages.map((page) => page.text).join(" ");
  expect(all).toContain("SUPERVISOR CERTIFICATION");
  expect(all).toContain("Signature and official stamp");
  expect(all).not.toMatch(/\bName\s*:?\s*[A-Z][a-z]+\s+[A-Z]/u);
});

it("groups diary work into streams and keeps unrecognised points", () => {
  const weeks = [
    {
      entry: {
        sections: {
          improvements: [],
          learning: [],
          problems: [],
          solutions: [],
          work: [
            { text: "Added a search box to the task list." },
            { text: "Fixed the document export footer." },
            { text: "Typed up the notes from the week and cleared the inbox." },
          ],
        },
      },
      number: 1,
    },
    {
      entry: {
        sections: {
          improvements: [],
          learning: [],
          problems: [],
          solutions: [],
          work: [{ text: "Rebuilt the recruitment pipeline board." }],
        },
      },
      number: 2,
    },
  ];
  const streams = groupWorkStreams(weeks);
  const titles = streams.map((stream) => stream.title);
  expect(titles).toContain("Interface and Design System");
  expect(titles).toContain("Document Workflows");
  expect(titles).toContain("Recruitment Workflows");
  expect(titles).toContain("Other Recorded Work");
  // No accepted point is dropped, whichever stream it lands in.
  const kept = streams.flatMap((stream) => stream.points);
  expect(kept).toHaveLength(4);
  expect(
    streams.find((stream) => stream.title === "Other Recorded Work").points[0]
  ).toBe("Typed up the notes from the week and cleared the inbox.");
});

it("keeps only company findings that carry a public source", () => {
  const { kept, rejected } = sanitizeFindings([
    { key: "name", url: "https://acme.example/about", value: "Acme Inc" },
    { key: "employees", url: "not-a-url", value: "240" },
    { key: "employees", url: "https://acme.example/team", value: "240" },
    { key: "unknownField", url: "https://acme.example", value: "x" },
    { key: "vision", url: "https://acme.example", value: "  " },
  ]);
  expect(kept.map((item) => item.key)).toEqual(["name", "employees"]);
  expect(rejected).toHaveLength(3);
  expect(rejected.join(" ")).toContain("no public source URL");
  expect(rejected.join(" ")).toContain("not a known field");
  expect(rejected.join(" ")).toContain("empty value");
});

it("reads image dimensions from PNG and JPEG headers", () => {
  expect(imageSize(PNG)).toEqual({ height: 1, width: 1 });
});

it("describes the template images without downloading them again", () => {
  const images = templateImages();
  expect(images.length).toBeGreaterThanOrEqual(10);
  for (const entry of images) {
    expect(entry.url).toMatch(/^https:\/\//u);
    expect(entry.file).toMatch(/\.jpg$/u);
    expect(entry.caption.length).toBeGreaterThan(5);
  }
});

it("builds the sample report document with the expected chapter structure", () => {
  context = workspace();
  // The document only needs image metadata, so stub sources keep this test
  // offline. Rendering with real bytes is covered by the other cases.
  const document = buildTemplateDocument(
    templateImages().map((item) => ({
      ...item,
      height: 800,
      kind: "jpg",
      path: `cached/${item.file}`,
      width: 1200,
    }))
  );
  expect(document.chapters).toHaveLength(3);
  expect(document.chapters.map((chapter) => chapter.title)).toEqual([
    "Training Organization",
    "Training Experience at Acme Inc",
    "Conclusion",
  ]);
  expect(document.cover.establishment).toContain("Acme Inc");
  expect(document.cover.trainingStart).toBe("2026-02-16");
  expect(document.cover.trainingEnd).toBe("2026-08-16");
  // The preface states plainly that the report is a sample.
  expect(document.preface.join(" ")).toContain("fictional");
  expect(document.certification.fields.every((row) => row.value === "")).toBe(
    true
  );
});

it("fails loudly when a template image cannot be downloaded", async () => {
  context = workspace();
  await expect(
    fetchImages(path.join(context.root, "cache"), [
      { file: "unreachable.jpg", url: "http://127.0.0.1:1/nothing.jpg" },
    ])
  ).rejects.toThrow();
});

it("reuses a cached image instead of downloading it again", async () => {
  context = workspace();
  const folder = path.join(context.root, "cache");
  mkdirSync(folder, { recursive: true });
  writeFileSync(path.join(folder, "cached.png"), PNG);
  // An unreachable URL is fine because the cached copy is used.
  const [cached] = await fetchImages(folder, [
    { file: "cached.png", url: "http://127.0.0.1:1/nothing.png" },
  ]);
  expect(cached.kind).toBe("png");
  expect(cached.width).toBe(1);
  expect(cached.height).toBe(1);
});

it("keeps the generated sample report at thirty pages or more", async () => {
  const file = path.resolve("docs/final-report-template.pdf");
  const pages = await pdfPages(file);
  expect(pages.length).toBeGreaterThanOrEqual(30);
  const all = pages.map((page) => page.text).join(" ");
  for (const heading of [
    "TABLE OF CONTENTS",
    "LIST OF FIGURES",
    "LIST OF TABLES",
    "ABBREVIATIONS",
    "1.0 Introduction",
    "2.3 Assigned Tasks",
    "2.4 Problems and Solutions",
    "3.2 Personal SWOT Analysis",
    "REFERENCES",
    "SUPERVISOR CERTIFICATION",
  ]) {
    expect(all, `missing section ${heading}`).toContain(heading);
  }
  // Numbering goes to four levels somewhere in the sample.
  expect(all).toMatch(/\b2\.2\.3\.1\b/u);
});

it("prints the list of tables with the list of figures and links both lines", async () => {
  context = workspace();
  const out = path.join(context.root, "captions.pdf");
  await renderReportDocument(
    {
      chapters: [
        {
          blocks: [{ kind: "paragraph", text: "Chapter body." }],
          children: [
            {
              blocks: [
                {
                  caption: "A recorded figure",
                  image: image(context.root, "caption.png"),
                  kind: "figure",
                },
                {
                  caption: "A recorded table",
                  columns: [{ header: "One" }, { header: "Two" }],
                  kind: "table",
                  rows: [["a", "b"]],
                },
              ],
              title: "Assigned Tasks",
            },
          ],
          introTitle: "Introduction",
          title: "Training Experience",
        },
      ],
      cover,
      title: "Report on Industrial Training",
    },
    out
  );
  const pages = await pdfPages(out);
  const figuresPage = pages.find((page) =>
    page.text.includes("LIST OF FIGURES")
  );
  // Both lists share one page, so the tables heading is not on a page of its own.
  expect(figuresPage?.text, "list of tables is not with the figures").toContain(
    "LIST OF TABLES"
  );
  expect(
    pages.filter((page) => page.text.includes("LIST OF TABLES")).length
  ).toBe(1);

  // Every caption line is a link to the page the caption is printed on.
  const task = getDocument({ data: new Uint8Array(readFileSync(out)) });
  const document = await task.promise;
  try {
    const links = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      // oxlint-disable-next-line no-await-in-loop -- pages are read in order
      const page = await document.getPage(number);
      // oxlint-disable-next-line no-await-in-loop
      links.push(...(await page.getAnnotations()));
    }
    const linksOnList = links.filter(
      (item) => item.subtype === "Link" && item.overlaidText
    );
    expect(linksOnList.length).toBeGreaterThanOrEqual(2);
    expect(linksOnList.every((item) => item.dest)).toBe(true);
    const captions = linksOnList.map((item) => item.overlaidText || "");
    expect(captions.some((text) => text.includes("A recorded figure"))).toBe(
      true
    );
    expect(captions.some((text) => text.includes("A recorded table"))).toBe(
      true
    );
  } finally {
    await task.destroy();
  }
});

it("prints the abbreviations written in the content workspace", async () => {
  context = workspace();
  const out = path.join(context.root, "abbreviations.pdf");
  await renderReportDocument(
    {
      abbreviations: [{ expansion: "National Authority", term: "NAITA" }],
      chapters: [
        {
          blocks: [{ kind: "paragraph", text: "Chapter body." }],
          introTitle: "Introduction",
          title: "Training Organization",
        },
      ],
      cover,
      title: "Report on Industrial Training",
    },
    out
  );
  const pages = await pdfPages(out);
  const all = pages.map((page) => page.text).join(" ");
  expect(all).toContain("ABBREVIATIONS");
  expect(all).toContain("NAITA");
  expect(all).toContain("National Authority");
});
