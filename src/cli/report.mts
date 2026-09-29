import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { diaryStatus } from "../diary/status.mts";
import { loadDiary, paths } from "../diary/store.mts";
import { loadCompany } from "../report/company.mts";
import { loadContent } from "../report/content.mts";
import { buildReportFromDiary } from "../report/from-diary.mts";
import { renderReportDocument } from "../report/render.mts";

const DEFAULT_NAME = "NAITA-Industrial-Training-Report-draft.pdf";

/**
 * The cover logo is the one image the report takes from a fixed place rather
 * than from a path the student names. The convention is a file called `logo` at
 * the top of the report folder, so any student can supply one without editing
 * code; several common extensions are tried because a logo is usually a PNG or
 * a JPEG. An explicit `--logo` always wins, and no logo at all is fine.
 */
const LOGO_NAMES = ["logo.png", "logo.jpg", "logo.jpeg"];
const findLogo = (reportRoot) => {
  for (const name of LOGO_NAMES) {
    const file = path.join(reportRoot, name);
    if (existsSync(file)) {
      return file;
    }
  }
  return null;
};

/**
 * Reports only what the workspace cannot supply yet, so the list shortens as
 * the student fills the profile and supplies the prose the renderer draws.
 */
const reportInputs = (missing) => {
  const items = [];
  if (missing.profile.length) {
    items.push(`Profile fields still blank: ${missing.profile.join(", ")}`);
  }
  if (!missing.supervisor) {
    items.push("Supervisor name and designation for the certification page");
  }
  if (!missing.prose.acknowledgement) {
    items.push("Acknowledgement text");
  }
  if (!missing.prose.preface) {
    items.push("Preface text");
  }
  if (!missing.prose.references) {
    items.push("Reference list with sources for every external claim");
  }
  if (!missing.prose.abbreviations) {
    items.push("Abbreviation list");
  }
  if (!missing.sections.events) {
    items.push("Events and non-technical experience for section 2.6");
  }
  if (missing.sections.placeholder.length) {
    items.push(
      `Section text still marked as a placeholder: ${missing.sections.placeholder.join(", ")}`
    );
  }
  if (missing.repositoryLanguage.length) {
    items.push(
      `${missing.repositoryLanguage.length} diary point(s) still use repository language and were left out of the report`
    );
  }
  if (missing.assets.unreadable) {
    items.push(
      `The asset register could not be read (${missing.assets.unreadable}), so its permission and redaction checks were not applied.`
    );
  }
  if (missing.assets.pending) {
    items.push(
      `${missing.assets.pending} asset(s) in the register still have a permission or redaction check outstanding.`
    );
  }
  return items;
};

/**
 * Walks the built document for any block still marked as a placeholder, so the
 * gap list names the section the student has not written yet instead of
 * guessing from the workspace layout.
 */
const pendingContentSections = (document) => {
  const pending = [];
  const visit = (nodes, section) => {
    for (const node of nodes || []) {
      if (node.kind === "placeholder") {
        pending.push(section || "unnamed section");
      }
      const title = node.title || section;
      if (node.blocks) {
        visit(node.blocks, title);
      }
      if (node.children) {
        visit(node.children, title);
      }
    }
  };
  visit(document.chapters, "");
  return pending;
};

/**
 * Asset register entries whose permission or redaction check is outstanding.
 *
 * The register is written by hand under `assets/`, so a broken or half-finished
 * file is expected rather than exceptional. It is read for the report's own
 * status line only, so an unreadable register reports the gap instead of
 * stopping the whole report.
 */
const pendingAssets = (reportRoot) => {
  const file = path.join(reportRoot, "assets", "register.json");
  if (!existsSync(file)) {
    return { pending: 0, unreadable: null };
  }
  let register;
  try {
    register = JSON.parse(readFileSync(file, "utf-8"));
  } catch (error) {
    return { pending: 0, unreadable: error.message };
  }
  const assets = Array.isArray(register?.assets) ? register.assets : [];
  return {
    pending: assets.filter(
      (asset) =>
        asset?.permissionStatus !== "approved" ||
        (asset?.redactionStatus !== "not-applicable" &&
          asset?.redactionStatus !== "checked")
    ).length,
    unreadable: null,
  };
};

export const reportCommand = async (workspace, options = {}) => {
  const diary = loadDiary(workspace);
  const status = await diaryStatus(diary);
  const reportRoot = path.join(paths(workspace).local, "report");
  const output = path.resolve(
    options.out || path.join(reportRoot, "output", DEFAULT_NAME)
  );
  const company = loadCompany(workspace);
  const { document, repositoryLanguage, warnings } = await buildReportFromDiary(
    diary,
    {
      abbreviations: options.abbreviations,
      acknowledgement: options.acknowledgement,
      company,
      preface: options.preface,
      references: options.references,
      reportRoot,
    }
  );
  const result = await renderReportDocument(document, output, {
    font: options.font,
    logo: options.logo || findLogo(reportRoot) || undefined,
  });
  const incompleteWeeks = status.weeks
    .filter((week) => !week.complete)
    .map((week) => ({
      missing: week.missing,
      missingDays: week.missingDays,
      number: week.number,
      review: week.reviewed,
      screenshots: week.screenshots.images.length,
    }));
  const content = loadContent(reportRoot);
  const pendingSections = pendingContentSections(document);
  const missing = {
    absencesConfirmed: status.absencesConfirmed,
    assets: pendingAssets(reportRoot),
    companyResearch: Object.keys(company.record || {}).length,
    incompleteWeeks,
    profile: status.profile.missing,
    prose: {
      abbreviations: content.abbreviations.length > 0,
      acknowledgement: content.acknowledgement.length > 0,
      preface: content.preface.length > 0,
      references: content.references.length > 0,
    },
    requiredProfile: status.profile.requiredMissing,
    sections: {
      events:
        content.events.paragraphs.length + content.events.items.length > 0,
      placeholder: pendingSections,
    },
    supervisor: Boolean(diary.config.supervisor),
  };
  missing.repositoryLanguage = repositoryLanguage;
  missing.reportInputs = reportInputs(missing);
  const missingCount =
    missing.profile.length +
    incompleteWeeks.length +
    missing.reportInputs.length +
    Number(!missing.absencesConfirmed) +
    Number(missing.companyResearch === 0);
  return {
    ...result,
    complete: status.complete && missingCount === 0,
    message: `Created report ${result.path} (${result.pages} pages, ${result.figures} figures, ${result.tables} tables). ${missingCount} input/checklist areas still need review.`,
    missing,
    warnings: [...warnings, ...repositoryLanguage],
  };
};

export const formatReport = (result) => {
  const profile = result.missing.profile.length
    ? result.missing.profile.join(", ")
    : "none";
  const weeks = result.missing.incompleteWeeks.length
    ? result.missing.incompleteWeeks.map((week) => week.number).join(", ")
    : "none";
  return [
    result.message,
    `Profile fields still blank: ${profile}.`,
    `Diary weeks still needing completion/review: ${weeks}.`,
    result.missing.companyResearch
      ? `Company facts recorded from public sources: ${result.missing.companyResearch}. Check each one before submission.`
      : "No company research saved. Run company --name 'NAME' to fill the organization chapter from public sources.",
    "Report inputs still needed:",
    ...result.missing.reportInputs.map((item) => `  - ${item}`),
    ...(result.warnings?.length
      ? ["", "Warnings:", ...result.warnings.map((item) => `  - ${item}`)]
      : []),
  ].join("\n");
};
