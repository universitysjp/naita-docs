/**
 * Reads the report's own written content out of the workspace.
 *
 * The tool knows nothing about any particular placement. The wording, the names,
 * the events, and the lists belong to the student, so they live as Markdown
 * under `local/report/content/`, one file per report section. This module only
 * knows the file layout and the two small conventions the renderer needs:
 *
 * - a blank line separates paragraphs,
 * - a `## Heading` line starts a new item, and `![caption](file.jpg)` inside an
 *   item is a photograph placed with that item.
 *
 * A section with no file is not an error. It returns empty, and the caller keeps
 * its placeholder so the draft still shows what the student has to write.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export interface ContentItem {
  figures: { caption: string; file: string }[];
  paragraphs: string[];
  title: string;
}

export interface ContentSection {
  items: ContentItem[];
  /** Prose before the first heading, for a section that is only paragraphs. */
  paragraphs: string[];
}

const FIGURE = /^!\[(?<caption>.*)\]\((?<file>[^)]+)\)$/u;
const HEADING = /^##\s+(?<title>.+)$/u;

/** One line of text with its Markdown noise removed, or nothing. */
const cleanLine = (line) => {
  const text = line.trim();
  if (!text || text.startsWith("#") || text.startsWith("<!--")) {
    return "";
  }
  return text.replace(/^[-*]\s+/u, "");
};

/**
 * Splits a Markdown file into the paragraphs before the first `##` heading and
 * the items under each heading. Text before the first heading belongs to the
 * section, because a lead paragraph usually introduces the whole section.
 */
export const parseSection = (markdown) => {
  const section = { items: [], paragraphs: [] };
  let current = null;
  for (const line of markdown.split(/\r?\n/u)) {
    const heading = HEADING.exec(line);
    if (heading) {
      current = { figures: [], paragraphs: [], title: heading.groups.title };
      section.items.push(current);
      continue;
    }
    const figure = FIGURE.exec(line.trim());
    if (figure && current) {
      current.figures.push({
        caption: figure.groups.caption,
        file: figure.groups.file,
      });
      continue;
    }
    const text = cleanLine(line);
    if (!text) {
      continue;
    }
    if (current) {
      current.paragraphs.push(text);
    } else {
      section.paragraphs.push(text);
    }
  }
  return section;
};

/** Every non-empty line as its own item, for a plain list of points. */
export const parseList = (markdown) =>
  markdown.split(/\r?\n/u).map(cleanLine).filter(Boolean);

/**
 * A reference written as one line per entry. The line is the whole citation,
 * so it is carried as the entry's title and the other parts stay empty rather
 * than being guessed.
 */
export const parseReferences = (markdown) =>
  parseList(markdown).map((title) => ({
    author: "",
    detail: "",
    title,
    url: "",
  }));

/** `KEY - expansion` or `KEY, expansion`, one per line. */
export const parseAbbreviations = (markdown) =>
  parseList(markdown).map((line) => {
    const match = /^(?<key>[A-Za-z0-9/+.-]+)\s*[-–—:,]\s*(?<value>.+)$/u.exec(
      line
    );
    return match
      ? { key: match.groups.key, value: match.groups.value }
      : { key: line, value: "" };
  });

const readMarkdown = (file) =>
  existsSync(file) ? readFileSync(file, "utf-8") : "";

const CONTENT_ROOT = "content";

/**
 * Loads every report section the renderer asks for. Paths are relative to the
 * report folder, so the same file layout works for any student.
 */
export const loadContent = (reportRoot) => {
  const at = (...parts) => path.join(reportRoot, CONTENT_ROOT, ...parts);
  const read = (...parts) => readMarkdown(at(...parts));

  return {
    abbreviations: parseAbbreviations(read("front-matter", "abbreviations.md")),
    acknowledgement: parseList(read("front-matter", "acknowledgement.md")),
    conclusion: parseList(read("chapters", "03-conclusion", "conclusion.md")),
    events: parseSection(
      read("chapters", "02-training-experience", "events.md")
    ),
    learningPeriod: parseList(
      read("chapters", "02-training-experience", "learning-period.md")
    ),
    managementPractices: parseList(
      read("chapters", "01-organization", "management-practices.md")
    ),
    natureOfBusiness: parseList(
      read("chapters", "01-organization", "nature-of-business.md")
    ),
    opportunities: parseList(
      read("chapters", "03-conclusion", "opportunities.md")
    ),
    organisationStructure: parseList(
      read("chapters", "01-organization", "organisation-structure.md")
    ),
    placementIntroduction: parseList(
      read("chapters", "02-training-experience", "placement-introduction.md")
    ),
    preface: parseList(read("front-matter", "preface.md")),
    references: parseReferences(read("back-matter", "references.md")),
    strengths: parseList(read("chapters", "03-conclusion", "strengths.md")),
    suggestions: parseList(read("chapters", "03-conclusion", "suggestions.md")),
    threats: parseList(read("chapters", "03-conclusion", "threats.md")),
    weaknesses: parseList(read("chapters", "03-conclusion", "weaknesses.md")),
  };
};
