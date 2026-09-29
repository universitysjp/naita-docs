import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import {
  loadContent,
  parseAbbreviations,
  parseList,
  parseSection,
} from "../../src/report/content.mts";

let context;

afterEach(() => {
  if (context) {
    rmSync(context, { force: true, recursive: true });
    context = undefined;
  }
});

const makeRoot = (files) => {
  context = mkdtempSync(path.join(tmpdir(), "naita-content-"));
  for (const [name, body] of Object.entries(files)) {
    const file = path.join(context, name);
    mkdirSync(path.dirname(file), { recursive: true });
    writeFileSync(file, body);
  }
  return context;
};

it("reads paragraphs, ignoring headings and empty lines", () => {
  expect(parseList("First line.\n\n## A heading\nSecond line.\n")).toEqual([
    "First line.",
    "Second line.",
  ]);
});

it("reads a section as a lead paragraph plus titled items with figures", () => {
  const section = parseSection(
    [
      "The lead paragraph.",
      "",
      "## First item",
      "Body text for the item.",
      "![A caption](photo.jpg)",
    ].join("\n")
  );
  expect(section.paragraphs).toEqual(["The lead paragraph."]);
  expect(section.items).toEqual([
    {
      figures: [{ caption: "A caption", file: "photo.jpg" }],
      paragraphs: ["Body text for the item."],
      title: "First item",
    },
  ]);
});

it("reads an abbreviation line into a key and an expansion", () => {
  expect(
    parseAbbreviations("NAITA - National Authority\nUI, User Interface\n")
  ).toEqual([
    { key: "NAITA", value: "National Authority" },
    { key: "UI", value: "User Interface" },
  ]);
});

it("keeps a line that has no separator as the key with an empty expansion", () => {
  expect(parseAbbreviations("ISO\n")).toEqual([{ key: "ISO", value: "" }]);
});

it("returns empty results for a report with no written content", () => {
  const content = loadContent(makeRoot({}));
  expect(content.acknowledgement).toEqual([]);
  expect(content.events).toEqual({ items: [], paragraphs: [] });
});

it("loads each report section from the content folder", () => {
  const content = loadContent(
    makeRoot({
      "content/back-matter/references.md": "A source.\n",
      "content/chapters/01-organization/nature-of-business.md":
        "What it does.\n",
      "content/chapters/03-conclusion/strengths.md": "One strength.\n",
      "content/front-matter/acknowledgement.md": "Thanks.\n",
    })
  );
  expect(content.references).toEqual([
    { author: "", detail: "", title: "A source.", url: "" },
  ]);
  expect(content.natureOfBusiness).toEqual(["What it does."]);
  expect(content.strengths).toEqual(["One strength."]);
  expect(content.acknowledgement).toEqual(["Thanks."]);
});
