import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, it } from "vitest";

import { addNavigation, isLinkablePage } from "../../src/report/navigation.mts";

const fourPages = async () => {
  const pdf = await PDFDocument.create();
  for (let page = 0; page < 4; page += 1) {
    pdf.addPage([595, 842]);
  }
  return pdf;
};

/**
 * Reads the finished bytes back the way a viewer does, because the objects are
 * written into compressed streams and a string search would never see them.
 */
const read = async (bytes) => {
  const task = getDocument({ data: new Uint8Array(bytes) });
  const document = await task.promise;
  try {
    const annotations = [];
    for (let number = 1; number <= document.numPages; number += 1) {
      // oxlint-disable-next-line no-await-in-loop -- pages are read in order
      const page = await document.getPage(number);
      // oxlint-disable-next-line no-await-in-loop
      annotations.push(...(await page.getAnnotations()));
    }
    return { annotations, outline: await document.getOutline() };
  } finally {
    await task.destroy();
  }
};

const flatten = (items) =>
  (items || []).flatMap((item) => [item, ...flatten(item.items)]);

it("writes one link per contents line, each with a destination", async () => {
  const pdf = await fourPages();
  addNavigation(pdf, {
    links: [
      { height: 12, pageIndex: 0, targetIndex: 1, width: 300, x: 72, y: 700 },
      { height: 12, pageIndex: 0, targetIndex: 3, width: 300, x: 72, y: 680 },
    ],
  });
  const { annotations } = await read(await pdf.save());
  const links = annotations.filter((item) => item.subtype === "Link");
  expect(links).toHaveLength(2);
  expect(links.every((link) => link.dest)).toBe(true);
});

it("nests the outline by depth and keeps every entry", async () => {
  const pdf = await fourPages();
  addNavigation(pdf, {
    outline: [
      { depth: 1, pageIndex: 1, title: "1.0 Introduction" },
      { depth: 2, pageIndex: 1, title: "1.1 About" },
      { depth: 3, pageIndex: 2, title: "1.1.1 Nature" },
      { depth: 1, pageIndex: 3, title: "2.0 Experience" },
    ],
  });
  const { outline } = await read(await pdf.save());
  expect(outline).toHaveLength(2);
  expect(outline[0].items).toHaveLength(1);
  expect(flatten(outline).map((item) => item.title)).toEqual([
    "1.0 Introduction",
    "1.1 About",
    "1.1.1 Nature",
    "2.0 Experience",
  ]);
});

it("gives every outline entry a destination", async () => {
  const pdf = await fourPages();
  addNavigation(pdf, {
    outline: [
      { depth: 1, pageIndex: 1, title: "1.0 Introduction" },
      { depth: 2, pageIndex: 3, title: "1.1 About" },
    ],
  });
  const { outline } = await read(await pdf.save());
  expect(flatten(outline).every((item) => item.dest)).toBe(true);
});

it("leaves the document alone when there is nothing to navigate", async () => {
  const pdf = await fourPages();
  addNavigation(pdf);
  const { annotations, outline } = await read(await pdf.save());
  expect(outline).toBeNull();
  expect(annotations).toHaveLength(0);
});

it("refuses a page index the document does not have", async () => {
  const pdf = await fourPages();
  expect(isLinkablePage(pdf, 0)).toBe(true);
  expect(isLinkablePage(pdf, 3)).toBe(true);
  expect(isLinkablePage(pdf, 4)).toBe(false);
  expect(isLinkablePage(pdf, -1)).toBe(false);
  expect(isLinkablePage(pdf, 1.5)).toBe(false);
});
