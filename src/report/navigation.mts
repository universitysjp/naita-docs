/**
 * Adds the navigation a word-processed report gives for free.
 *
 * A PDF that is only a stack of pages forces a reader to scroll. Two things fix
 * that, and both are written here at the low level because `pdf-lib` has no
 * helper for either:
 *
 * - the document outline, the bookmark tree a viewer shows in its sidebar,
 * - a link annotation over each contents line, so clicking a line in the table of
 *   contents jumps to the page that line points at.
 *
 * Both are addressed to a page object rather than a page number, so they keep
 * working after the body pages are copied in behind the front matter.
 */

import { PDFArray, PDFHexString, PDFName, PDFNumber } from "pdf-lib";

export interface OutlineEntry {
  depth: number;
  pageIndex: number;
  title: string;
}

export interface ContentsLink {
  height: number;
  pageIndex: number;
  targetIndex: number;
  width: number;
  x: number;
  y: number;
}

/** Page height in points, used as the top of a destination. */
const PAGE_TOP = 842;

const name = (value) => PDFName.of(value);

/**
 * Sets a key from a plain value. `context.assign` only accepts PDF objects, so
 * every value written below goes through here, and a missing value leaves the
 * key out rather than storing something empty.
 */
const put = (dict, key, value) => {
  if (value === undefined || value === null) {
    return;
  }
  dict.set(name(key), value);
};

/**
 * A destination that opens the target page at its top left corner, written flat
 * as `[page /XYZ left top zoom]`. A viewer that expects the view name in the
 * same array as the page reference will not follow a link whose view is a nested
 * array, and silently shows a document with dead contents entries.
 */
const topOfPage = (context, page) =>
  context.obj([
    page.ref,
    name("XYZ"),
    PDFNumber.of(0),
    PDFNumber.of(PAGE_TOP),
    PDFNumber.of(0),
  ]);

const buildOutline = (pdf, entries) => {
  const { context } = pdf;
  const rootRef = context.nextRef();
  const root = context.obj({});
  put(root, "Type", name("Outlines"));

  const nodes = entries
    .filter((entry) => entry.pageIndex >= 0)
    .map((entry) => {
      const page = pdf.getPage(entry.pageIndex);
      const ref = context.nextRef();
      const dict = context.obj({});
      // The reference has to be filled now: a child points at its parent, and a
      // viewer walks from a parent to its first child. Both are addresses.
      context.assign(ref, dict);
      put(dict, "Title", PDFHexString.fromText(entry.title));
      put(dict, "Dest", topOfPage(context, page));
      put(dict, "Parent", rootRef);
      return { children: [], depth: entry.depth, dict, ref };
    });

  const topLevel = [];
  const stack = [];
  for (const node of nodes) {
    // Close every open section at or below this depth, so a new chapter is a
    // sibling of the last chapter and not a child of its last subsection.
    while (stack.length && stack.at(-1).depth >= node.depth) {
      stack.pop();
    }
    const owner = stack.at(-1);
    if (owner) {
      owner.children.push(node);
      put(node.dict, "Parent", owner.ref);
    } else {
      topLevel.push(node);
    }
    stack.push(node);
  }

  // A section's Next jumps over its own children, so a node's sibling is the
  // next entry at the same depth or shallower.
  for (const [index, node] of nodes.entries()) {
    node.sibling = nodes
      .slice(index + 1)
      .find((candidate) => candidate.depth <= node.depth);
  }

  const linkSiblings = (list) => {
    for (const [index, node] of list.entries()) {
      if (node.sibling) {
        put(node.dict, "Next", node.sibling.ref);
      }
      if (index > 0) {
        put(node.dict, "Prev", list[index - 1].ref);
      }
      if (node.children.length) {
        put(node.dict, "First", node.children[0].ref);
        put(node.dict, "Count", PDFNumber.of(node.children.length));
        linkSiblings(node.children);
      }
    }
  };
  linkSiblings(topLevel);

  put(root, "First", topLevel[0]?.ref);
  put(root, "Last", topLevel.at(-1)?.ref);
  put(root, "Count", PDFNumber.of(nodes.length));
  context.assign(rootRef, root);
  return rootRef;
};

/** One invisible link annotation, so a click on a contents line jumps a page. */
const addLink = (pdf, link) => {
  const { context } = pdf;
  const source = pdf.getPage(link.pageIndex);
  const target = pdf.getPage(link.targetIndex);
  const annot = context.obj({});
  put(annot, "Type", name("Annot"));
  put(annot, "Subtype", name("Link"));
  // A zero border keeps the link invisible, so the contents page looks printed.
  put(annot, "Border", context.obj([0, 0, 0]));
  put(
    annot,
    "Rect",
    context.obj([link.x, link.y, link.x + link.width, link.y + link.height])
  );
  put(annot, "Dest", topOfPage(context, target));
  const annotRef = context.nextRef();
  context.assign(annotRef, annot);
  const existing = source.node.get(name("Annots"));
  const annots = existing instanceof PDFArray ? existing : null;
  if (annots) {
    annots.push(annotRef);
    return;
  }
  source.node.set(name("Annots"), context.obj([annotRef]));
};

/**
 * Writes the outline and the contents links onto the finished document. Called
 * once, after every page exists, so a page index always refers to a real page.
 */
export const addNavigation = (pdf, { links = [], outline = [] } = {}) => {
  if (outline.length) {
    pdf.catalog.set(name("Outlines"), buildOutline(pdf, outline));
    pdf.catalog.set(name("PageMode"), name("UseOutlines"));
  }
  for (const link of links) {
    addLink(pdf, link);
  }
  return pdf;
};

/** A link is only safe once the page it names exists in the document. */
export const isLinkablePage = (pdf, pageIndex) =>
  Number.isInteger(pageIndex) &&
  pageIndex >= 0 &&
  pageIndex < pdf.getPageCount();
