import { randomUUID } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  writeFileSync,
} from "node:fs";
import nodePath from "node:path";
import { fileURLToPath } from "node:url";

import { PDFDocument } from "pdf-lib";

import { scanScreenshots } from "../diary/screenshots.mts";
import { embedTimes } from "./fonts.mts";
import { drawInfo, drawWeek } from "./forms.mts";
import { addTemplatePage } from "./layout.mts";
import { drawWeeklyNotes } from "./weekly.mts";

export const TEMPLATE_PATH = fileURLToPath(
  new URL("../../docs/daily-diary-template.pdf", import.meta.url)
);

export const renderDiary = async (diary, outputPath, options = {}) => {
  const templatePath = nodePath.resolve(options.template || TEMPLATE_PATH);
  const target = nodePath.resolve(outputPath);
  if (
    target === templatePath ||
    (existsSync(target) && realpathSync(target) === realpathSync(templatePath))
  ) {
    throw new Error("Output must not overwrite the source PDF template.");
  }
  if (!target.toLowerCase().endsWith(".pdf")) {
    throw new Error("Output filename must end with .pdf.");
  }
  const source = await PDFDocument.load(readFileSync(templatePath));
  if (
    source.getPageCount() !== 8 ||
    source
      .getPages()
      .some(
        (page) =>
          Math.abs(page.getWidth() - 595.32) > 1 ||
          Math.abs(page.getHeight() - 841.92) > 1
      )
  ) {
    throw new Error("Expected the supplied eight-page A4 NAITA template.");
  }
  const pdf = await PDFDocument.create();
  const { font, path: fontPath } = await embedTimes(pdf, options.font);
  pdf.setTitle(`NAITA Internship Diary - ${diary.config.name}`);
  pdf.setAuthor(diary.config.name);
  const templates = await pdf.embedPdf(source, source.getPageIndices());
  addTemplatePage(pdf, templates[0]);
  drawInfo(addTemplatePage(pdf, templates[1]), diary.config, font);
  for (const week of diary.weeks) {
    // oxlint-disable-next-line no-await-in-loop -- PDF page/figure drawing is sequential and order-dependent
    const screenshots = await scanScreenshots(week);
    if (screenshots.errors.length) {
      throw new Error(
        `Week ${week.number} has invalid screenshots: ${screenshots.errors.join("; ")}`
      );
    }
    const overflow = drawWeek(
      addTemplatePage(pdf, templates[2]),
      week,
      diary.config,
      font
    );
    // oxlint-disable-next-line no-await-in-loop -- PDF page/figure drawing is sequential and order-dependent
    await drawWeeklyNotes(pdf, templates, week, font, screenshots, overflow);
  }
  for (let index = 5; index < templates.length; index += 1) {
    addTemplatePage(pdf, templates[index]);
  }
  const bytes = await pdf.save();
  mkdirSync(nodePath.dirname(target), { recursive: true });
  const temp = `${target}.${randomUUID()}.tmp`;
  writeFileSync(temp, bytes);
  renameSync(temp, target);
  return { font: fontPath, pages: pdf.getPageCount(), path: target };
};
