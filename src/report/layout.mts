/**
 * Page geometry, text styles, and the table and callout renderers.
 *
 * A4 portrait, one-inch margins, Times New Roman at 12 pt with 18 pt leading.
 * Each block renderer returns the height it used, so the writer can decide
 * whether a block still fits on the page before drawing it.
 */

import { rgb } from "pdf-lib";

import { drawText, printable, wrap } from "../pdf/layout.mts";

export const PAGE = {
  height: 841.89,
  marginBottom: 68,
  marginLeft: 72,
  marginRight: 72,
  marginTop: 72,
  width: 595.28,
};

export const CONTENT = PAGE.width - PAGE.marginLeft - PAGE.marginRight;
export const BODY_SIZE = 12;
export const LEADING = 18;

export const STYLE = {
  bulletIndent: 20,
  calloutIndent: 14,
  captionSize: 10.5,
  h1Size: 17,
  h2Size: 14,
  h3Size: 12.5,
  h4Size: 12,
  listIndent: 26,
  tableSize: 10.5,
};

const RULE = 0.55;
const TABLE_LEADING = 14;
const TABLE_CELL_PADDING = 10;
const TABLE_HEADER_PADDING = 8;
const TABLE_ROW_PADDING = 7;

export const horizontalRule = (page, x, y, width, thickness = RULE) => {
  page.drawLine({
    color: rgb(0, 0, 0),
    end: { x: x + width, y },
    start: { x, y },
    thickness,
  });
};

/**
 * Column widths are proportional to each column's weight. The last column
 * absorbs the rounding remainder so the table's right edge lands exactly on the
 * right margin instead of a fraction over or under it.
 */
export const columnWidths = (columns) => {
  const total = columns.reduce((sum, column) => sum + (column.weight ?? 1), 0);
  const widths = columns.map(
    (column) => ((column.weight ?? 1) / total) * CONTENT
  );
  const used = widths.reduce((sum, width) => sum + width, 0);
  return widths.map((width, index) =>
    index === widths.length - 1 ? width + (CONTENT - used) : width
  );
};

/** Horizontal position of a line inside a cell, honouring its alignment. */
const cellX = (column, left, width, line, font) => {
  const size = STYLE.tableSize;
  const lineWidth = font.widthOfTextAtSize(line, size);
  const align = column.align ?? "left";
  if (align === "right") {
    return left + width - 5 - lineWidth;
  }
  if (align === "center") {
    return left + (width - lineWidth) / 2;
  }
  return left + 5;
};

const cellLines = (row, widths, font) =>
  row.map((cell, index) =>
    wrap(
      printable(cell),
      font,
      STYLE.tableSize,
      widths[index] - TABLE_CELL_PADDING
    )
  );

const rowHeight = (lines) =>
  Math.max(...lines.map((cell) => cell.length)) * TABLE_LEADING +
  TABLE_ROW_PADDING;

// The measured height includes the trailing gap below the last rule, so a
// pagination check reserves the same space the draw actually consumes.
const TABLE_TRAILING = 10;

export const drawTable = (page, table, fonts, options = {}) => {
  const size = STYLE.tableSize;
  const widths = columnWidths(table.columns);
  const header = cellLines(
    table.columns.map((column) => column.header),
    widths,
    fonts.bold
  );
  const headerHeight =
    Math.max(...header.map((cell) => cell.length)) * TABLE_LEADING +
    TABLE_HEADER_PADDING;
  const body = table.rows.map((row) => cellLines(row, widths, fonts.regular));
  const bodyHeights = body.map(rowHeight);
  const total =
    headerHeight +
    bodyHeights.reduce((sum, value) => sum + value, 0) +
    TABLE_TRAILING;

  let { y } = options;
  page.drawRectangle({
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.7,
    color: rgb(0.94, 0.94, 0.94),
    height: headerHeight,
    width: CONTENT,
    x: options.x,
    y: y - headerHeight,
  });
  let { x } = options;
  for (const [index, cell] of header.entries()) {
    for (const [lineIndex, line] of cell.entries()) {
      drawText(
        page,
        line,
        cellX(table.columns[index], x, widths[index], line, fonts.bold),
        y - 12 - lineIndex * TABLE_LEADING,
        size,
        fonts.bold
      );
    }
    x += widths[index];
  }
  horizontalRule(page, options.x, y - headerHeight, CONTENT, 0.7);
  y -= headerHeight;

  for (const [rowIndex, row] of body.entries()) {
    y -= bodyHeights[rowIndex];
    let cellLeft = options.x;
    for (const [index, cell] of row.entries()) {
      for (const [lineIndex, line] of cell.entries()) {
        drawText(
          page,
          line,
          cellX(
            table.columns[index],
            cellLeft,
            widths[index],
            line,
            fonts.regular
          ),
          y + bodyHeights[rowIndex] - 11 - lineIndex * TABLE_LEADING,
          size,
          fonts.regular
        );
      }
      cellLeft += widths[index];
    }
    horizontalRule(
      page,
      options.x,
      y,
      CONTENT,
      rowIndex === body.length - 1 ? 0.7 : 0.35
    );
  }
  return total;
};

export const tableHeight = (table, fonts) => {
  const widths = columnWidths(table.columns);
  const header = cellLines(
    table.columns.map((column) => column.header),
    widths,
    fonts.bold
  );
  const headerHeight =
    Math.max(...header.map((cell) => cell.length)) * TABLE_LEADING +
    TABLE_HEADER_PADDING;
  const bodyHeight = table.rows.reduce(
    (sum, row) => sum + rowHeight(cellLines(row, widths, fonts.regular)),
    0
  );
  return headerHeight + bodyHeight + TABLE_TRAILING;
};

const CALLOUT_SIZE = 11.5;
const CALLOUT_LEADING = 16;

export const drawCallout = (page, text, fonts, options = {}) => {
  const indent = STYLE.calloutIndent;
  const lines = wrap(
    printable(text),
    fonts.regular,
    CALLOUT_SIZE,
    CONTENT - indent * 2
  );
  const height = lines.length * CALLOUT_LEADING + 16;
  page.drawRectangle({
    borderColor: rgb(0, 0, 0),
    borderWidth: 0.6,
    color: rgb(0.97, 0.97, 0.97),
    height,
    width: CONTENT,
    x: options.x,
    y: options.y - height,
  });
  let y = options.y - 13;
  if (options.title) {
    drawText(page, options.title, options.x + indent, y, 11, fonts.bold);
    y -= 15;
  }
  for (const line of lines) {
    drawText(page, line, options.x + indent, y, CALLOUT_SIZE, fonts.regular);
    y -= CALLOUT_LEADING;
  }
  return height;
};
