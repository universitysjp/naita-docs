import path from "node:path";

import { diaryStatus } from "../diary/status.mts";
import { loadDiary, paths } from "../diary/store.mts";
import { loadCompany } from "../report/company.mts";
import { buildReportFromDiary } from "../report/from-diary.mts";
import { renderReportDocument } from "../report/render.mts";

const DEFAULT_NAME = "NAITA-Industrial-Training-Report-draft.pdf";

const reportInputs = () => [
  "University, faculty, and department wording",
  "Course, degree, and field",
  "Student number and NAITA registration number",
  "Approved organization facts and image permissions",
  "Supervisor name and designation for the certification page",
  "Any events or non-technical experience the trainee wants recorded",
];

export const reportCommand = async (workspace, options = {}) => {
  const diary = loadDiary(workspace);
  const status = await diaryStatus(diary);
  const reportRoot = path.join(paths(workspace).local, "report");
  const output = path.resolve(
    options.out || path.join(reportRoot, "output", DEFAULT_NAME)
  );
  const company = loadCompany(workspace);
  const { document, warnings } = await buildReportFromDiary(diary, {
    abbreviations: options.abbreviations,
    acknowledgement: options.acknowledgement,
    company,
    preface: options.preface,
    references: options.references,
  });
  const result = await renderReportDocument(document, output, {
    font: options.font,
    logo: options.logo || path.join(reportRoot, "usjp.jpg"),
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
  const missing = {
    absencesConfirmed: status.absencesConfirmed,
    companyResearch: Object.keys(company.record || {}).length,
    incompleteWeeks,
    profile: status.profile.missing,
    reportInputs: reportInputs(),
    requiredProfile: status.profile.requiredMissing,
  };
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
    warnings,
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
