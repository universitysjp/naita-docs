/**
 * The report writer: walks a `ReportDocument`, lays out blocks, and collects
 * the entries that the contents, figure, and table lists need.
 *
 * Numbering comes from the tree, so a heading label such as `2.3.1.2` is
 * computed here and never written by hand. Figures and tables are numbered in
 * the order the reader meets them, which is why they are blocks inside a
 * section instead of a list collected at the end.
 */

import { readFileSync } from "node:fs";

import { rgb } from "pdf-lib";

import { embedImage } from "../pdf/images.mts";
import { drawText, printable, wrap } from "../pdf/layout.mts";
import { drawDrawing, drawingHeight } from "./drawings.mts";
import {
  BODY_SIZE,
  CONTENT,
  drawCallout,
  drawTable,
  horizontalRule,
  LEADING,
  PAGE,
  STYLE,
  tableHeight,
} from "./layout.mts";

// A figure taller than this is scaled down; one that would not fit in a whole
// page is scaled to fit rather than being split.
const MAX_FIGURE_HEIGHT = 320;

// Words kept lowercase inside a title unless they open or close it.
const TITLE_SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "as",
  "at",
  "but",
  "by",
  "for",
  "from",
  "in",
  "nor",
  "of",
  "on",
  "or",
  "per",
  "the",
  "to",
  "via",
  "with",
]);

/**
 * Headings are written in sentence case in the workspace, and a report is
 * expected to print them in title case. A word that already carries capitals
 * (`HRMS`, `TrackIT`, `DevOps`) is left exactly as written, so an acronym or a
 * product name is never flattened.
 */
export const titleCase = (title) =>
  String(title)
    .split(" ")
    .map((word, index, words) => {
      if (/[A-Z]/u.test(word.slice(1)) || /[A-Z]/u.test(word)) {
        return word;
      }
      const lower = word.toLowerCase();
      const isEdge = index === 0 || index === words.length - 1;
      if (!isEdge && TITLE_SMALL_WORDS.has(lower)) {
        return lower;
      }
      return lower.replace(/^./u, (first) => first.toUpperCase());
    })
    .join(" ");

const HEADING_GAP_BEFORE = { 1: 0, 2: 16, 3: 13, 4: 11 };
const HEADING_GAP_AFTER = { 1: 20, 2: 10, 3: 8, 4: 7 };
const HEADING_SIZES = {
  1: STYLE.h1Size,
  2: STYLE.h2Size,
  3: STYLE.h3Size,
  4: STYLE.h4Size,
};

/**
 * Times New Roman has a round bullet but no arrowhead, so the arrow is drawn as
 * a vector instead of being silently swapped for a different glyph. A report
 * prints two marker shapes only: the arrow for reported work, and the round dot
 * for the trainee's own assessment. Any other marker in a document is read as
 * the arrow, so a list can never print a third shape.
 */
const drawArrowhead = (page, x, y, size) => {
  const head = size * 0.42;
  page.drawLine({
    color: rgb(0, 0, 0),
    end: { x: x + head, y: y + size * 0.28 },
    start: { x, y: y + size * 0.06 },
    thickness: 0.9,
  });
  page.drawLine({
    color: rgb(0, 0, 0),
    end: { x: x + head, y: y + size * 0.28 },
    start: { x, y: y + size * 0.5 },
    thickness: 0.9,
  });
};

const drawBulletMarker = (page, marker, x, y, fonts) => {
  const size = BODY_SIZE;
  if (marker === "dot") {
    drawText(page, "•", x, y, size, fonts.regular);
    return;
  }
  drawArrowhead(page, x, y, size);
};

export class ReportWriter {
  constructor(pdf, fonts, options = {}) {
    this.fonts = fonts;
    this.numbering = options.numberPages !== false;
    this.page = null;
    this.pdf = pdf;
    this.registries = {
      figures: [],
      tables: [],
    };
    this.y = 0;
  }

  get pageNumber() {
    return this.pdf.getPageCount();
  }

  newPage() {
    this.page = this.pdf.addPage([PAGE.width, PAGE.height]);
    if (this.numbering) {
      this.drawPageNumber();
    }
    this.y = PAGE.height - PAGE.marginTop;
    return this.page;
  }

  drawPageNumber() {
    const text = String(this.pdf.getPageCount());
    drawText(
      this.page,
      text,
      (PAGE.width - this.fonts.regular.widthOfTextAtSize(text, 10.5)) / 2,
      PAGE.height - 40,
      10.5,
      this.fonts.regular
    );
  }

  atBottom(height) {
    return this.y - height < PAGE.marginBottom;
  }

  ensure(height) {
    if (this.atBottom(height)) {
      this.newPage();
      return true;
    }
    return false;
  }

  space(size) {
    this.y -= size;
  }

  /** Keeps a heading with at least the first lines of the text under it. */
  heading(text, depth) {
    const size = HEADING_SIZES[depth];
    const font = depth <= 3 ? this.fonts.bold : this.fonts.boldItalic;
    const lines = wrap(printable(text), font, size, CONTENT);
    const height =
      HEADING_GAP_BEFORE[depth] +
      lines.length * (size + 5) +
      HEADING_GAP_AFTER[depth];
    this.ensure(height + LEADING * 2);
    this.y -= HEADING_GAP_BEFORE[depth];
    for (const line of lines) {
      drawText(this.page, line, PAGE.marginLeft, this.y, size, font);
      this.y -= size + 5;
    }
    if (depth <= 2) {
      horizontalRule(
        this.page,
        PAGE.marginLeft,
        this.y + 4,
        CONTENT,
        depth === 1 ? 0.9 : 0.5
      );
    }
    this.y -= HEADING_GAP_AFTER[depth];
    return { depth, page: this.pageNumber };
  }

  chapterTitle(title) {
    this.newPage();
    this.y = PAGE.height - 150;
    const size = 20;
    for (const line of wrap(printable(title), this.fonts.bold, size, CONTENT)) {
      drawText(
        this.page,
        line,
        (PAGE.width - this.fonts.bold.widthOfTextAtSize(line, size)) / 2,
        this.y,
        size,
        this.fonts.bold
      );
      this.y -= size + 8;
    }
    horizontalRule(
      this.page,
      PAGE.marginLeft + 90,
      this.y + 8,
      CONTENT - 180,
      0.9
    );
    this.y -= 18;
  }

  paragraph(text, { bold = false } = {}) {
    const font = bold ? this.fonts.bold : this.fonts.regular;
    const lines = wrap(printable(text), font, BODY_SIZE, CONTENT);
    for (const [index, line] of lines.entries()) {
      this.ensure(LEADING);
      drawText(this.page, line, PAGE.marginLeft, this.y, BODY_SIZE, font);
      this.y -= LEADING;
      if (index === lines.length - 2) {
        this.y -= 6;
      }
    }
  }

  /**
   * Figures and tables are numbered in reading order. The number is reserved
   * first so the caption can be measured for pagination, then the entry is
   * recorded with the page it finally landed on, after any page break.
   */
  reserveCaption(kind, caption) {
    const number = this.registries[kind].length + 1;
    return kind === "figures"
      ? `Figure ${number}: ${caption}`
      : `Table ${number}: ${caption}`;
  }

  commitCaption(kind, caption, label, page) {
    this.registries[kind].push({ caption, label, page });
  }

  async figure(image, caption) {
    const label = this.reserveCaption("figures", caption);
    const captionHeight =
      wrap(label, this.fonts.regular, STYLE.captionSize, CONTENT).length * 14;
    // A figure is scaled to the text width, capped in height, and then kept
    // whole: if it does not fit in what is left of the page it moves to a new
    // one. Fitting it into the remaining space instead would shrink a
    // photograph to an unreadable thumbnail at the foot of a full page.
    const scale = Math.min(
      CONTENT / image.width,
      MAX_FIGURE_HEIGHT / image.height,
      1
    );
    const width = image.width * scale;
    const height = image.height * scale;
    this.ensure(height + captionHeight + 16);
    const page = this.pageNumber;
    const bytes = readFileSync(image.path);
    const embedded = await embedImage(this.pdf, bytes, image.kind);
    this.page.drawImage(embedded, {
      height,
      width,
      x: PAGE.marginLeft + (CONTENT - width) / 2,
      y: this.y - height,
    });
    this.y -= height + 8;
    this.caption(label);
    this.y -= 10;
    this.commitCaption("figures", caption, label, page);
    return { label, page };
  }

  /** A drawing sits directly under its caption, as the sample does. */
  // oxlint-disable-next-line require-await -- keeps figure and drawing on the same async signature
  async drawing(drawing, caption) {
    const label = this.reserveCaption("figures", caption);
    const height = drawingHeight(drawing, this.fonts);
    this.ensure(
      height +
        wrap(label, this.fonts.regular, STYLE.captionSize, CONTENT).length *
          14 +
        16
    );
    const page = this.pageNumber;
    drawDrawing(this.page, drawing, {
      bottom: this.y - height,
      fonts: this.fonts,
      height,
      left: PAGE.marginLeft,
      page: this.page,
      width: CONTENT,
    });
    this.y -= height + 8;
    this.caption(label);
    this.y -= 10;
    this.commitCaption("figures", caption, label, page);
    return { label, page };
  }

  caption(text) {
    const lines = wrap(
      printable(text),
      this.fonts.regular,
      STYLE.captionSize,
      CONTENT
    );
    for (const line of lines) {
      this.ensure(14);
      drawText(
        this.page,
        line,
        PAGE.marginLeft,
        this.y,
        STYLE.captionSize,
        this.fonts.regular
      );
      this.y -= 14;
    }
  }

  table(table) {
    const label = this.reserveCaption("tables", table.caption);
    const height = tableHeight(table, this.fonts);
    this.ensure(height + 34);
    const page = this.pageNumber;
    this.caption(label);
    this.y -= 6;
    this.y -= drawTable(this.page, table, this.fonts, {
      x: PAGE.marginLeft,
      y: this.y,
    });
    this.y -= 12;
    this.commitCaption("tables", table.caption, label, page);
    return { label, page };
  }

  callout(text, title) {
    const lines = wrap(printable(text), this.fonts.regular, 11.5, CONTENT - 28);
    const height = lines.length * 16 + (title ? 15 : 0) + 16;
    this.ensure(height + 6);
    this.y -= drawCallout(this.page, text, this.fonts, {
      title,
      x: PAGE.marginLeft,
      y: this.y,
    });
    this.y -= 12;
  }

  bulletMarker(marker = "arrow") {
    drawBulletMarker(this.page, marker, PAGE.marginLeft, this.y, this.fonts);
  }

  bullets(items, marker) {
    for (const item of items) {
      const lines = wrap(
        printable(item),
        this.fonts.regular,
        BODY_SIZE,
        CONTENT - 20
      );
      for (const [index, line] of lines.entries()) {
        this.ensure(LEADING);
        if (index === 0) {
          this.bulletMarker(marker);
        }
        drawText(
          this.page,
          line,
          PAGE.marginLeft + 20,
          this.y,
          BODY_SIZE,
          this.fonts.regular
        );
        this.y -= LEADING;
      }
      this.y -= 3;
    }
  }

  list(items, ordered) {
    for (const [index, item] of items.entries()) {
      const lines = wrap(
        printable(item),
        this.fonts.regular,
        BODY_SIZE,
        CONTENT - 26
      );
      for (const [lineIndex, line] of lines.entries()) {
        this.ensure(LEADING);
        if (lineIndex === 0) {
          drawText(
            this.page,
            ordered ? `${index + 1}.` : "•",
            PAGE.marginLeft + 6,
            this.y,
            BODY_SIZE,
            this.fonts.regular
          );
        }
        drawText(
          this.page,
          line,
          PAGE.marginLeft + 26,
          this.y,
          BODY_SIZE,
          this.fonts.regular
        );
        this.y -= LEADING;
      }
    }
  }

  keyValue(rows) {
    const labelWidth =
      Math.max(
        ...rows.map((row) =>
          this.fonts.bold.widthOfTextAtSize(printable(row.label), 12)
        )
      ) + 14;
    for (const row of rows) {
      const values = wrap(
        printable(row.value),
        this.fonts.regular,
        12,
        CONTENT - labelWidth
      );
      const labels = wrap(
        printable(row.label),
        this.fonts.bold,
        12,
        labelWidth - 8
      );
      const height = Math.max(values.length, labels.length) * LEADING + 3;
      this.ensure(height);
      const top = this.y;
      for (const [lineIndex, line] of labels.entries()) {
        drawText(
          this.page,
          line,
          PAGE.marginLeft,
          top - lineIndex * LEADING,
          12,
          this.fonts.bold
        );
      }
      for (const [lineIndex, line] of values.entries()) {
        drawText(
          this.page,
          line,
          PAGE.marginLeft + labelWidth,
          top - lineIndex * LEADING,
          12,
          this.fonts.regular
        );
      }
      this.y -= height;
    }
    this.y -= 6;
  }

  placeholder(note) {
    this.bullets([note], "dash");
  }

  rule() {
    this.ensure(10);
    horizontalRule(this.page, PAGE.marginLeft, this.y, CONTENT, 0.5);
    this.y -= 12;
  }

  pageBreak() {
    this.newPage();
  }

  async renderBlocks(blocks = []) {
    for (const block of blocks) {
      // oxlint-disable-next-line no-await-in-loop -- blocks are laid out in reading order and a figure embeds an image
      await this.renderBlock(block);
    }
  }

  async renderBlock(block) {
    switch (block.kind) {
      case "bullets": {
        this.bullets(block.items, block.marker);
        break;
      }
      case "callout": {
        this.callout(block.text, block.title);
        break;
      }
      case "drawing": {
        await this.drawing(block.drawing, block.caption);
        break;
      }
      case "figure": {
        await this.figure(block.image, block.caption);
        break;
      }
      case "keyValue": {
        this.keyValue(block.rows ?? []);
        break;
      }
      case "list": {
        this.list(block.items, block.ordered);
        break;
      }
      case "pageBreak": {
        this.pageBreak();
        break;
      }
      case "paragraph": {
        this.paragraph(block.text, { bold: block.bold });
        this.y -= 6;
        break;
      }
      case "placeholder": {
        this.placeholder(block.note);
        break;
      }
      case "spacer": {
        this.space(block.size ?? 12);
        break;
      }
      case "table": {
        this.table(block);
        break;
      }
      default: {
        throw new Error(`Unknown report block: ${block.kind}`);
      }
    }
  }

  /**
   * Renders a chapter and its whole subtree. The chapter's own heading is `N.0`,
   * so the first child becomes `N.1` and numbering stays flat, which is what a
   * reader expects from a report numbered to four levels.
   */
  /**
   * A chapter opens on a fresh page with a centred title, then its own `N.0`
   * heading. Children continue at `N.1`, so numbering stays flat and matches
   * how a reader expects a report numbered to four levels to read.
   */
  async renderChapter(chapter, index, entries) {
    this.chapterTitle(`Chapter ${index + 1}: ${titleCase(chapter.title)}`);
    const heading = titleCase(chapter.introTitle || chapter.title);
    const chapterEntry = this.heading(`${index + 1}.0 ${heading}`, 1);
    entries.push({
      depth: 1,
      label: `${index + 1}.0`,
      page: chapterEntry.page,
      title: heading,
    });
    await this.renderBlocks(chapter.blocks);
    for (const [childIndex, child] of (chapter.children || []).entries()) {
      // oxlint-disable-next-line no-await-in-loop -- pages are laid out in reading order
      await this.renderSection(child, [index + 1, childIndex + 1], entries);
    }
  }

  async renderSection(section, path, entries) {
    const label = path.join(".");
    const depth = Math.min(4, path.length);
    const title = titleCase(section.title);
    const entry = this.heading(`${label} ${title}`, depth);
    entries.push({ depth, label, page: entry.page, title });
    await this.renderBlocks(section.blocks);
    for (const [childIndex, child] of (section.children || []).entries()) {
      // oxlint-disable-next-line no-await-in-loop -- pages are laid out in reading order
      await this.renderSection(child, [...path, childIndex + 1], entries);
    }
  }
}
