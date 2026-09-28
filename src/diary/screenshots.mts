import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, lstatSync } from "node:fs";
import path from "node:path";

import { PDFDocument } from "pdf-lib";

import { embedImage } from "../pdf/images.mts";

export const scanScreenshots = async (week) => {
  const result = {
    errors: [],
    folder: week.screenshotFolder,
    ignored: [],
    images: [],
    notRequiredReason: week.entry.screenshots.notRequiredReason,
  };
  if (!existsSync(week.screenshotFolder)) {
    return result;
  }
  if (lstatSync(week.screenshotFolder).isSymbolicLink()) {
    throw new Error(
      "Screenshot folders must be real folders, not symbolic links."
    );
  }
  const scratch = await PDFDocument.create();
  for (const name of readdirSync(week.screenshotFolder).toSorted((a, b) =>
    a.localeCompare(b, "en", { numeric: true })
  )) {
    if (name.startsWith(".")) {
      continue;
    }
    const file = path.join(week.screenshotFolder, name);
    const stat = lstatSync(file);
    if (stat.isSymbolicLink()) {
      result.errors.push(`${name}: symbolic links are not supported.`);
      continue;
    }
    if (!stat.isFile()) {
      result.ignored.push(name);
      continue;
    }
    const extension = path.extname(name).toLowerCase();
    if (![".png", ".jpg", ".jpeg"].includes(extension)) {
      result.ignored.push(name);
      continue;
    }
    try {
      if (stat.size > 25 * 1024 * 1024) {
        throw new Error("image exceeds 25 MB");
      }
      const bytes = readFileSync(file);
      // oxlint-disable-next-line no-await-in-loop -- each image is embedded into one shared document, in listing order
      const embedded = await embedImage(
        scratch,
        bytes,
        extension === ".png" ? "png" : "jpg"
      );
      if (!embedded.width || !embedded.height) {
        throw new Error("image has no dimensions");
      }
      result.images.push({
        caption:
          week.entry.screenshots.captions[name]?.trim() ||
          name.replace(/\.[^.]+$/u, "").replaceAll(/[-_]/gu, " "),
        hash: createHash("sha256").update(bytes).digest("hex"),
        height: embedded.height,
        kind: extension === ".png" ? "png" : "jpg",
        name,
        path: file,
        width: embedded.width,
      });
    } catch (error) {
      result.errors.push(`${name}: ${error.message || String(error)}`);
    }
  }
  return result;
};
