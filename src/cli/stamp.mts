import {
  existsSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

import { PDFDocument } from "pdf-lib";

import { paths } from "../diary/paths.mts";

/**
 * Collects the pages of a finished PDF that need a physical stamp.
 *
 * A supervisor should be handed a short printout of the pages that carry a
 * signature or certification block, not the whole diary or report. A page is
 * named by number or by its position from the end, because the page that needs a
 * stamp is normally the last one and that number changes every time the document
 * grows.
 */
const KEYWORD_PAGES = {
  first: 1,
  last: -1,
  penultimate: -2,
  second: 2,
};

/** "last,penultimate,2" or "2 5" becomes sorted, de-duplicated page numbers. */
export const parsePageSpec = (spec, pageCount) => {
  const wanted = String(spec)
    .split(/[\s,]+/u)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean);
  if (!wanted.length) {
    throw new Error("Give at least one page, for example --pages last,2.");
  }
  const pages = [];
  for (const item of wanted) {
    const keyword = KEYWORD_PAGES[item];
    const number = keyword ?? Number(item);
    if (!Number.isInteger(number) || number === 0) {
      throw new Error(
        `Cannot understand page "${item}". Use a page number or one of: ${Object.keys(KEYWORD_PAGES).join(", ")}.`
      );
    }
    const resolved = number > 0 ? number : pageCount + number + 1;
    if (resolved < 1 || resolved > pageCount) {
      throw new Error(
        `Page ${item} does not exist in a document of ${pageCount} pages.`
      );
    }
    if (!pages.includes(resolved)) {
      pages.push(resolved);
    }
  }
  // Print order follows the document, not the order the pages were asked for.
  return pages.toSorted((a, b) => a - b);
};

const loadDocument = async (file) => {
  if (!existsSync(file)) {
    return null;
  }
  try {
    return await PDFDocument.load(new Uint8Array(readFileSync(file)));
  } catch {
    return null;
  }
};

/**
 * The file name of a generated document is the user's choice, so an output
 * directory is searched for the most recently written PDF rather than assuming
 * one name. An explicit path always wins.
 */
const latestPdf = (folder, fallback) => {
  if (!existsSync(folder)) {
    return fallback;
  }
  const candidates = readdirSync(folder)
    .filter((name) => name.toLowerCase().endsWith(".pdf"))
    .map((name) => path.join(folder, name))
    .filter((file) => !file.endsWith("NAITA-Stamp-Pages.pdf"));
  if (!candidates.length) {
    return fallback;
  }
  const ranked = candidates
    .map((file) => ({ file, time: statSync(file).mtimeMs }))
    .toSorted((a, b) => b.time - a.time);
  const [newest] = ranked;
  const { file } = newest || { file: fallback };
  return file;
};

const requestedSources = (workspace, options) => {
  const { local } = paths(workspace);
  const reportRoot = path.join(local, "report");
  const sources = [
    {
      default: latestPdf(
        path.join(reportRoot, "output"),
        path.join(
          reportRoot,
          "output",
          "NAITA-Industrial-Training-Report-draft.pdf"
        )
      ),
      // The certification page carries the stamp and the supervisor's signature.
      defaultPages: "last",
      key: "report",
    },
    {
      default: latestPdf(
        path.join(local, "output"),
        path.join(local, "output", "NAITA-Daily-Diary.pdf")
      ),
      // The first signed sheet, and the sheet before the last one, are the two
      // that carry a supervisor stamp in a submitted diary.
      defaultPages: "second,penultimate",
      key: "diary",
    },
  ];
  // Naming nothing means both defaults: the report certification page and the
  // diary sheets that get stamped. Naming one limits the output to that document.
  const named = sources.filter(
    (source) =>
      options[source.key] !== undefined || options[`${source.key}-pages`]
  );
  return (named.length ? named : sources).map((source) => ({
    pages: options[`${source.key}-pages`] || source.defaultPages,
    path: path.resolve(options[source.key] || source.default),
  }));
};

export const stampCommand = async (workspace, options = {}) => {
  const requested = requestedSources(workspace, options);
  const missing = [];
  const collected = [];
  for (const source of requested) {
    // oxlint-disable-next-line no-await-in-loop -- sources are read in print order
    const document = await loadDocument(source.path);
    if (!document) {
      missing.push(source.path);
      continue;
    }
    const pageCount = document.getPageCount();
    collected.push({
      document,
      pages: parsePageSpec(source.pages, pageCount),
      path: source.path,
    });
  }
  if (missing.length) {
    throw new Error(
      `Cannot stamp pages from a document that is not there: ${missing.join(", ")}. Generate it first.`
    );
  }
  const output = await PDFDocument.create();
  for (const entry of collected) {
    // oxlint-disable-next-line no-await-in-loop -- pages are copied in print order
    const copied = await output.copyPages(
      entry.document,
      entry.pages.map((page) => page - 1)
    );
    for (const page of copied) {
      output.addPage(page);
    }
  }
  const target = path.resolve(
    options.out || path.join(collected[0].path, "..", "NAITA-Stamp-Pages.pdf")
  );
  writeFileSync(target, await output.save());
  return {
    pages: output.getPageCount(),
    path: target,
    sources: collected.map((entry) => ({
      pages: entry.pages,
      path: entry.path,
    })),
  };
};

export const formatStamp = (result) =>
  [
    `Created ${result.path} (${result.pages} page(s) for stamping).`,
    ...result.sources.map(
      (entry) => `  ${entry.path}: ${entry.pages.join(", ")}`
    ),
  ].join("\n");
