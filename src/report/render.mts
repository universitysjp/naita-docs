/**
 * Assembles a full report PDF from a `ReportDocument`.
 *
 * The contents, list of figures, and list of tables need page numbers that only
 * exist once the body has been laid out, so the body is rendered first into its
 * own document with no page numbers. The front matter is then built, its
 * length measured, and the body pages copied in with the correct numbers
 * stamped on. Every recorded page number shifts by the same front matter
 * length, so the lists are correct without a second full body render.
 */

import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { PDFDocument, rgb } from "pdf-lib";

import { embedTimesFamily } from "../pdf/fonts.mts";
import { embedImage } from "../pdf/images.mts";
import { drawText, printable, wrap } from "../pdf/layout.mts";
import { CONTENT, LEADING, PAGE } from "./layout.mts";
import { addNavigation, isLinkablePage } from "./navigation.mts";
import { ReportWriter } from "./writer.mts";

const LIST_SIZE = 11.5;
const LIST_LEADING = 17;
const LIST_INDENT = 14;
const PAGE_NUMBER_SIZE = 10.5;
const PAGE_NUMBER_Y = PAGE.height - 40;

const kindOf = (bytes) =>
  bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e ? "png" : "jpg";

const writeAtomic = (target, bytes) => {
  mkdirSync(path.dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  writeFileSync(temp, bytes);
  renameSync(temp, target);
};

const centerText = (page, fonts, text, y, size, font) => {
  const value = printable(text);
  drawText(
    page,
    value,
    (PAGE.width - font.widthOfTextAtSize(value, size)) / 2,
    y,
    size,
    font
  );
};

const stampPageNumber = (page, fonts, number) => {
  const text = String(number);
  drawText(
    page,
    text,
    (PAGE.width - fonts.regular.widthOfTextAtSize(text, PAGE_NUMBER_SIZE)) / 2,
    PAGE_NUMBER_Y,
    PAGE_NUMBER_SIZE,
    fonts.regular
  );
};

const addBlankPage = (pdf) => pdf.addPage([PAGE.width, PAGE.height]);

const drawCover = async (pdf, fonts, document, logo) => {
  const page = addBlankPage(pdf);
  const { cover } = document;
  const { height } = PAGE;
  centerText(
    page,
    fonts,
    "National Apprenticeship & Industrial Training",
    height - 74,
    15,
    fonts.bold
  );
  centerText(page, fonts, "Authority", height - 96, 15, fonts.bold);
  centerText(page, fonts, document.title, height - 170, 18, fonts.bold);
  centerText(page, fonts, "At", height - 198, 12, fonts.regular);
  centerText(page, fonts, cover.establishment, height - 222, 16, fonts.bold);
  if (cover.establishmentAddress) {
    centerText(
      page,
      fonts,
      cover.establishmentAddress,
      height - 242,
      11.5,
      fonts.regular
    );
  }
  let cursor = height - 272;
  if (logo && existsSync(logo)) {
    const bytes = readFileSync(logo);
    // oxlint-disable-next-line no-await-in-loop -- a single optional logo
    const embedded = await embedImage(pdf, bytes, kindOf(bytes));
    const size = 112;
    page.drawImage(embedded, {
      height: size,
      width: size,
      x: (PAGE.width - size) / 2,
      y: cursor - size,
    });
    cursor -= size + 16;
  }
  // The academic home of the degree is one part per line: joined into a single
  // line it is wider than the page and the ends are cut off.
  for (const line of cover.instituteLines || []) {
    centerText(page, fonts, line, cursor, 12.5, fonts.regular);
    cursor -= 17;
  }
  cursor -= 3;
  if (cover.trainingLocation) {
    centerText(
      page,
      fonts,
      cover.trainingLocation,
      cursor,
      11.5,
      fonts.regular
    );
    cursor -= 22;
  }
  const rows = [
    ["Name", cover.name],
    ["Student No", cover.studentNumber],
    ["Course", cover.course],
    ["Field", cover.field],
    ["Category", cover.category],
    ["NAITA Reg. No", cover.naitaRegistration],
    ["Training Period", `${cover.trainingStart} to ${cover.trainingEnd}`],
  ].filter(([, value]) => value);
  let y = cursor - 22;
  for (const [label, value] of rows) {
    drawText(page, label, 104, y, 12, fonts.bold);
    drawText(page, ":", 214, y, 12, fonts.regular);
    drawText(page, printable(value), 226, y, 12, fonts.regular);
    y -= 23;
  }
};

const drawProsePage = (pdf, fonts, title, paragraphs) => {
  let page = addBlankPage(pdf);
  centerText(page, fonts, title, PAGE.height - 84, 15, fonts.bold);
  let y = PAGE.height - 126;
  for (const paragraph of paragraphs) {
    const lines = wrap(printable(paragraph), fonts.regular, 12, CONTENT);
    if (y - lines.length * LEADING < PAGE.marginBottom) {
      page = addBlankPage(pdf);
      y = PAGE.height - PAGE.marginTop;
    }
    for (const line of lines) {
      drawText(page, line, PAGE.marginLeft, y, 12, fonts.regular);
      y -= LEADING;
    }
    y -= 10;
  }
};

/** Fills the gap between a label and its page number with dots, as the sample does. */
const leader = (fonts, line, pageWidth, indent) => {
  const lineWidth = fonts.regular.widthOfTextAtSize(line, LIST_SIZE);
  const dotsWidth = CONTENT - indent - lineWidth - pageWidth - 12;
  if (dotsWidth <= 30) {
    return line;
  }
  const dotWidth = fonts.regular.widthOfTextAtSize(".", LIST_SIZE);
  return `${line} ${".".repeat(Math.max(4, Math.floor(dotsWidth / dotWidth)))}`;
};

/**
 * A contents-style list with dot leaders. A long label wraps and keeps its page
 * number on the last line, which is how a reader scans the list.
 */
const drawEntryList = (pdf, fonts, title, entries, anchors) => {
  if (!entries.length) {
    return 0;
  }
  let page = addBlankPage(pdf);
  let y = PAGE.height - 120;
  const start = () => {
    page = addBlankPage(pdf);
    y = PAGE.height - PAGE.marginTop;
  };
  centerText(page, fonts, title, PAGE.height - 84, 15, fonts.bold);
  for (const entry of entries) {
    const label = printable(
      `${entry.label ? `${entry.label} ` : ""}${entry.title}`
    );
    const pageText = String(entry.page);
    const pageWidth = fonts.regular.widthOfTextAtSize(pageText, LIST_SIZE);
    const indent = (entry.depth - 1) * LIST_INDENT;
    const lines = wrap(
      label,
      fonts.regular,
      LIST_SIZE,
      CONTENT - indent - pageWidth - 16
    );
    const needed = lines.length * LIST_LEADING + 5;
    if (y - needed < PAGE.marginBottom) {
      start();
    }
    const firstLineY = y;
    for (const [index, line] of lines.entries()) {
      const last = index === lines.length - 1;
      // The page number sits on the last line, after a dot leader, so a wrapped
      // label still points at the page its last line is on.
      const text = last ? leader(fonts, line, pageWidth, indent) : line;
      drawText(
        page,
        text,
        PAGE.marginLeft + indent,
        y,
        LIST_SIZE,
        fonts.regular
      );
      if (last) {
        drawText(
          page,
          pageText,
          PAGE.width - PAGE.marginRight - pageWidth,
          y,
          LIST_SIZE,
          fonts.regular
        );
      }
      y -= LIST_LEADING;
    }
    // The whole line, including the dot leader and the page number, is the
    // clickable area, so a reader can click anywhere along it.
    anchors?.push({
      height: lines.length * LIST_LEADING,
      pageIndex: pdf.getPageCount() - 1,
      targetPage: entry.page,
      width: PAGE.width - PAGE.marginRight - (PAGE.marginLeft + indent),
      x: PAGE.marginLeft + indent,
      y: firstLineY - LIST_SIZE * 0.25,
    });
    y -= 5;
  }
  return entries.length;
};

const drawCaptionList = (pdf, fonts, title, entries) => {
  if (!entries.length) {
    return 0;
  }
  let page = addBlankPage(pdf);
  let y = PAGE.height - 120;
  const start = () => {
    page = addBlankPage(pdf);
    y = PAGE.height - PAGE.marginTop;
  };
  centerText(page, fonts, title, PAGE.height - 84, 15, fonts.bold);
  for (const entry of entries) {
    const pageText = String(entry.page);
    const pageWidth = fonts.regular.widthOfTextAtSize(pageText, LIST_SIZE);
    const label = `${entry.label}: ${entry.caption}`;
    const lines = wrap(
      label,
      fonts.regular,
      LIST_SIZE,
      CONTENT - pageWidth - 16
    );
    if (y - lines.length * LIST_LEADING - 6 < PAGE.marginBottom) {
      start();
    }
    for (const [index, line] of lines.entries()) {
      const last = index === lines.length - 1;
      const text = last ? leader(fonts, line, pageWidth, 0) : line;
      drawText(page, text, PAGE.marginLeft, y, LIST_SIZE, fonts.regular);
      if (last) {
        drawText(
          page,
          pageText,
          PAGE.width - PAGE.marginRight - pageWidth,
          y,
          LIST_SIZE,
          fonts.regular
        );
      }
      y -= LIST_LEADING;
    }
    y -= 5;
  }
  return entries.length;
};
const drawAbbreviations = (pdf, fonts, abbreviations) => {
  let page = addBlankPage(pdf);
  centerText(page, fonts, "ABBREVIATIONS", PAGE.height - 84, 15, fonts.bold);
  let y = PAGE.height - 120;
  const termWidth =
    Math.max(
      ...abbreviations.map((item) =>
        fonts.bold.widthOfTextAtSize(printable(item.term), 12)
      )
    ) + 20;
  for (const item of abbreviations) {
    const lines = wrap(
      printable(item.expansion),
      fonts.regular,
      12,
      CONTENT - termWidth
    );
    if (y - lines.length * LEADING < PAGE.marginBottom) {
      page = addBlankPage(pdf);
      y = PAGE.height - PAGE.marginTop;
    }
    drawText(page, printable(item.term), PAGE.marginLeft, y, 12, fonts.bold);
    for (const [index, line] of lines.entries()) {
      drawText(
        page,
        line,
        PAGE.marginLeft + termWidth,
        y - index * LEADING,
        12,
        fonts.regular
      );
    }
    y -= lines.length * LEADING + 5;
  }
  return abbreviations.length;
};

/** One printed line for a reference, skipping the parts it does not carry. */
const referenceText = (reference) =>
  [
    reference.author,
    reference.title,
    reference.detail,
    reference.url ? `Available at: ${reference.url}.` : "",
  ]
    .filter(Boolean)
    .join(". ");

const drawReferences = (writer, references) => {
  writer.newPage();
  const entry = writer.heading("REFERENCES", 1);
  for (const reference of references) {
    const text = referenceText(reference);
    const lines = wrap(
      printable(text),
      writer.fonts.regular,
      11.5,
      CONTENT - 20
    );
    for (const [index, line] of lines.entries()) {
      writer.ensure(16);
      if (index === 0) {
        writer.bulletMarker("arrow");
      }
      drawText(
        writer.page,
        line,
        PAGE.marginLeft + 20,
        writer.y,
        11.5,
        writer.fonts.regular
      );
      writer.y -= 16;
    }
    writer.y -= 8;
  }
  return entry;
};

const drawSignatureBlock = (writer, certification) => {
  writer.newPage();
  const entry = writer.heading(
    certification.title || "Supervisor Certification",
    1
  );
  if (certification.declaration) {
    writer.paragraph(certification.declaration);
    writer.y -= 10;
  }
  for (const row of certification.fields || []) {
    writer.ensure(38);
    drawText(
      writer.page,
      row.label,
      PAGE.marginLeft,
      writer.y,
      12,
      writer.fonts.regular
    );
    drawText(
      writer.page,
      ":",
      PAGE.marginLeft + 150,
      writer.y,
      12,
      writer.fonts.regular
    );
    const lines = wrap(
      printable(row.value),
      writer.fonts.regular,
      12,
      CONTENT - 190
    );
    for (const [index, line] of lines.entries()) {
      drawText(
        writer.page,
        line,
        PAGE.marginLeft + 172,
        writer.y - index * LEADING,
        12,
        writer.fonts.regular
      );
    }
    writer.y -= 36;
  }
  writer.y -= 30;
  writer.ensure(100);
  drawText(
    writer.page,
    "Signature and official stamp",
    PAGE.marginLeft,
    writer.y,
    12,
    writer.fonts.regular
  );
  writer.y -= 48;
  writer.page.drawLine({
    color: rgb(0, 0, 0),
    end: { x: PAGE.marginLeft + 230, y: writer.y },
    start: { x: PAGE.marginLeft, y: writer.y },
    thickness: 0.7,
  });
  return entry;
};

const renderBody = async (document, options) => {
  const pdf = await PDFDocument.create();
  const fonts = await embedTimesFamily(pdf, options.font);
  // Page numbers are stamped after the front matter length is known.
  const writer = new ReportWriter(pdf, fonts, { numberPages: false });
  const entries = [];
  for (const [index, chapter] of document.chapters.entries()) {
    // oxlint-disable-next-line no-await-in-loop -- pages are laid out in reading order
    await writer.renderChapter(chapter, index, entries);
  }
  if (document.references?.length) {
    entries.push({
      depth: 1,
      label: "",
      page: drawReferences(writer, document.references).page,
      title: "References",
    });
  }
  for (const [index, section] of (document.appendices || []).entries()) {
    const label = `A.${index + 1}`;
    writer.newPage();
    const entry = writer.heading(`${label} ${section.title}`, 1);
    entries.push({ depth: 1, label, page: entry.page, title: section.title });
    // oxlint-disable-next-line no-await-in-loop -- pages are laid out in reading order
    await writer.renderBlocks(section.blocks);
  }
  if (document.certification) {
    entries.push({
      depth: 1,
      label: "",
      page: drawSignatureBlock(writer, document.certification).page,
      title: document.certification.title || "Supervisor certification",
    });
  }
  return {
    entries,
    figures: writer.registries.figures,
    pages: pdf.getPageCount(),
    pdf,
    tables: writer.registries.tables,
  };
};

/**
 * Builds the front matter, shifting every body page number by `shift`. Passing
 * `shift` as null measures the front matter without printing numbers, which is
 * how the final shift is discovered.
 */
const buildFrontMatter = async (document, options, body, shift) => {
  const pdf = await PDFDocument.create();
  const fonts = await embedTimesFamily(pdf, options.font);
  const offset = (page) => (shift === null ? page : page + shift);
  // Where each contents line was printed, kept so the finished document can put
  // a clickable link over it.
  const anchors = [];
  const entries = body.entries.map((entry) => ({
    ...entry,
    page: offset(entry.page),
  }));
  const figures = body.figures.map((item) => ({
    ...item,
    page: offset(item.page),
  }));
  const tables = body.tables.map((item) => ({
    ...item,
    page: offset(item.page),
  }));
  await drawCover(pdf, fonts, document, options.logo);
  const order = document.frontMatterOrder || [
    "acknowledgement",
    "preface",
    "tableOfContents",
    "listOfFigures",
    "listOfTables",
    "abbreviations",
  ];
  for (const kind of order) {
    if (kind === "acknowledgement" && document.acknowledgement) {
      drawProsePage(pdf, fonts, "ACKNOWLEDGEMENT", document.acknowledgement);
    }
    if (kind === "preface" && document.preface) {
      drawProsePage(pdf, fonts, "PREFACE", document.preface);
    }
    if (kind === "tableOfContents") {
      drawEntryList(pdf, fonts, "TABLE OF CONTENTS", entries, anchors);
    }
    if (kind === "listOfFigures") {
      drawCaptionList(
        pdf,
        fonts,
        "LIST OF FIGURES",
        figures.map((item) => ({
          caption: item.caption,
          label: item.label.split(":")[0],
          page: item.page,
        }))
      );
    }
    if (kind === "listOfTables") {
      drawCaptionList(
        pdf,
        fonts,
        "LIST OF TABLES",
        tables.map((item) => ({
          caption: item.caption,
          label: item.label.split(":")[0],
          page: item.page,
        }))
      );
    }
    if (kind === "abbreviations" && document.abbreviations?.length) {
      drawAbbreviations(pdf, fonts, document.abbreviations);
    }
  }
  return { anchors, fonts, frontPages: pdf.getPageCount(), pdf };
};

export const renderReportDocument = async (
  document,
  outputPath,
  options = {}
) => {
  const target = path.resolve(outputPath);
  if (!target.toLowerCase().endsWith(".pdf")) {
    throw new Error("Report output filename must end with .pdf.");
  }
  const body = await renderBody(document, options);
  // The front matter is laid out once to learn its length, then rebuilt with
  // the shifted page numbers. Both passes run the same code, so the measured
  // length always matches the printed one.
  const measured = await buildFrontMatter(document, options, body, null);
  const shift = measured.frontPages;
  const front = await buildFrontMatter(document, options, body, shift);
  const { pdf } = front;
  const copied = await pdf.copyPages(
    body.pdf,
    Array.from({ length: body.pages }, (_, index) => index)
  );
  for (const page of copied) {
    pdf.addPage(page);
    stampPageNumber(
      pdf.getPage(pdf.getPageCount() - 1),
      front.fonts,
      pdf.getPageCount()
    );
  }
  // A printed page number is 1-based, so a page that carries the number n is at
  // index n - 1 in the finished document.
  const links = front.anchors
    .map((anchor) => ({
      height: anchor.height,
      pageIndex: anchor.pageIndex,
      targetIndex: anchor.targetPage - 1,
      width: anchor.width,
      x: anchor.x,
      y: anchor.y,
    }))
    .filter((link) => isLinkablePage(pdf, link.pageIndex))
    .filter((link) => isLinkablePage(pdf, link.targetIndex));
  const outline = body.entries
    .map((entry) => ({
      depth: entry.depth,
      pageIndex: entry.page + shift - 1,
      title: `${entry.label ? `${entry.label} ` : ""}${entry.title}`,
    }))
    .filter((entry) => isLinkablePage(pdf, entry.pageIndex));
  addNavigation(pdf, { links, outline });
  pdf.setTitle(document.title);
  pdf.setAuthor(document.cover.name);
  pdf.setSubject("Industrial training report");
  const bytes = await pdf.save();
  writeAtomic(target, bytes);
  return {
    figures: body.figures.length,
    frontMatterPages: shift,
    links: links.length,
    outline: outline.length,
    pages: pdf.getPageCount(),
    path: target,
    tables: body.tables.length,
  };
};
