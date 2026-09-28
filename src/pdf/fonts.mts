import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import nodePath from "node:path";

import fontkit from "@pdf-lib/fontkit";

export const findTimesFont = (explicit) => {
  const requested = explicit || process.env.NAITA_TIMES_FONT;
  if (requested) {
    if (!existsSync(nodePath.resolve(requested))) {
      throw new Error(`Font not found: ${requested}`);
    }
    return nodePath.resolve(requested);
  }
  const candidates = [
    "C:\\Windows\\Fonts\\times.ttf",
    "/System/Library/Fonts/Supplemental/Times New Roman.ttf",
    "/Library/Fonts/Times New Roman.ttf",
    nodePath.join(homedir(), "Library/Fonts/Times New Roman.ttf"),
    "/usr/share/fonts/truetype/msttcorefonts/Times_New_Roman.ttf",
    "/usr/share/fonts/truetype/msttcorefonts/times.ttf",
    nodePath.join(homedir(), ".local/share/fonts/times.ttf"),
  ];
  const path = candidates.find((candidate) => existsSync(candidate));
  if (!path) {
    throw new Error(
      "Times New Roman was not found. Install it or pass --font /path/to/times.ttf (or NAITA_TIMES_FONT)."
    );
  }
  return path;
};

const siblingFont = (regular, names) => {
  const directory = nodePath.dirname(regular);
  return names
    .map((name) => nodePath.join(directory, name))
    .find((sibling) => existsSync(sibling));
};

export const findTimesFamily = (explicit) => {
  const regular = findTimesFont(explicit);
  const family = {
    bold: siblingFont(regular, ["Times New Roman Bold.ttf", "timesbd.ttf"]),
    boldItalic: siblingFont(regular, [
      "Times New Roman Bold Italic.ttf",
      "timesbi.ttf",
    ]),
    italic: siblingFont(regular, ["Times New Roman Italic.ttf", "timesi.ttf"]),
    regular,
  };
  const missing = Object.entries(family)
    .filter(([, path]) => !path)
    .map(([name]) => name);
  if (missing.length) {
    throw new Error(
      `Times New Roman variants are missing: ${missing.join(", ")}. Install the full font family or pass --font.`
    );
  }
  return family;
};

// oxlint-disable-next-line require-await -- async keeps the pdf-lib promise contract; callers await this helper
const embedFont = async (pdf, path) => {
  const bytes = readFileSync(path);
  const metadata = fontkit.create(bytes);
  if (
    !/TimesNewRoman|Times New Roman/iu.test(
      `${metadata.familyName} ${metadata.postscriptName}`
    )
  ) {
    throw new Error(`Font is not Times New Roman: ${path}`);
  }
  return pdf.embedFont(bytes, { subset: true });
};

export const embedTimesFamily = async (pdf, explicit) => {
  const paths = findTimesFamily(explicit);
  pdf.registerFontkit(fontkit);
  return {
    bold: await embedFont(pdf, paths.bold),
    boldItalic: await embedFont(pdf, paths.boldItalic),
    italic: await embedFont(pdf, paths.italic),
    paths,
    regular: await embedFont(pdf, paths.regular),
  };
};

export const embedTimes = async (pdf, explicit) => {
  const family = await embedTimesFamily(pdf, explicit);
  return { font: family.regular, path: family.paths.regular };
};
