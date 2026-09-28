import { readFileSync } from "node:fs";

import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

export const pdfPages = async (path) => {
  const task = getDocument({
    data: new Uint8Array(readFileSync(path)),
    useSystemFonts: true,
  });
  const pdf = await task.promise;
  try {
    const pages = [];
    for (let number = 1; number <= pdf.numPages; number += 1) {
      // Pages are read one at a time so pdf.js keeps a single live render
      // queue; parallel getPage calls make font loading order non-deterministic.
      // oxlint-disable-next-line no-await-in-loop
      const page = await pdf.getPage(number);
      // oxlint-disable-next-line no-await-in-loop
      const content = await page.getTextContent();
      pages.push({
        items: content.items.filter((item) => "str" in item),
        number,
        styles: content.styles,
        text: content.items.map((item) => item.str || "").join(" "),
      });
    }
    return pages;
  } finally {
    await task.destroy();
  }
};
