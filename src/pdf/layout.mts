import { rgb } from "pdf-lib";

export const printable = (value) =>
  String(value ?? "")
    .replaceAll(/[\u2010-\u2015]/gu, "-")
    // oxlint-disable-next-line no-control-regex -- keep control bytes out of PDF text streams
    .replaceAll(/[\u0000-\u001F\u007F-\u009F]/gu, " ")
    .replaceAll(/\s+/gu, " ")
    .trim();

export const wrap = (value, font, size, width) => {
  const words = printable(value).split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (const word of words) {
    if (line && font.widthOfTextAtSize(`${line} ${word}`, size) <= width) {
      line += ` ${word}`;
      continue;
    }
    if (line) {
      lines.push(line);
      line = "";
    }
    for (const character of word) {
      if (line && font.widthOfTextAtSize(line + character, size) > width) {
        lines.push(line);
        line = "";
      }
      line += character;
    }
  }
  if (line) {
    lines.push(line);
  }
  return lines;
};

export const drawText = (page, value, x, y, size, font) => {
  const text = printable(value);
  const characters = new Set(font.getCharacterSet());
  const missing = [...text].find(
    (character) => !characters.has(character.codePointAt(0))
  );
  if (missing) {
    throw new Error(
      `Times New Roman cannot print ${JSON.stringify(missing)}. Edit the diary point or caption containing it.`
    );
  }
  page.drawText(text, { color: rgb(0, 0, 0), font, size, x, y });
};

export const drawSingleLine = (
  page,
  value,
  x,
  y,
  width,
  font,
  preferred = 10,
  clearDots = false
) => {
  if (!value) {
    return;
  }
  let size = preferred;
  while (size > 7 && font.widthOfTextAtSize(printable(value), size) > width) {
    size -= 0.25;
  }
  if (font.widthOfTextAtSize(printable(value), size) > width) {
    throw new Error(
      `Text does not fit the profile/location field: ${value}. Please shorten it.`
    );
  }
  if (clearDots) {
    page.drawRectangle({
      color: rgb(1, 1, 1),
      height: size + 10,
      width: font.widthOfTextAtSize(printable(value), size) + 3,
      x: x - 1,
      // The source dotted guide is four points below the raised value.
      y: y - 7,
    });
  }
  drawText(page, value, x, y, size, font);
};

export const addTemplatePage = (pdf, template) => {
  const page = pdf.addPage([template.width, template.height]);
  page.drawPage(template, {
    height: template.height,
    width: template.width,
    x: 0,
    y: 0,
  });
  return page;
};

export const bulletLines = (points, font, size, width) =>
  points.flatMap((point) =>
    wrap(point.text, font, size, width - 12).map((text, index) => ({
      first: index === 0,
      text,
    }))
  );
