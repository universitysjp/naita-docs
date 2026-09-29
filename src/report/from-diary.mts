/**
 * Builds a report document from the local diary workspace.
 *
 * The diary is the evidence base. Work streams are grouped by what the student
 * was building rather than by week, figures sit inside the section that explains
 * them, and anything the workspace cannot support stays a visible question
 * instead of being filled in.
 *
 * A work point is assigned to a stream by counting whole-word matches. Ties go
 * to the earlier stream, so a point naming both a screen and a service lands in
 * the broader one. The order is the stream order in the report, from the
 * user-facing work down to the foundations.
 */

import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { allocatedMonthCount } from "../diary/dates.mts";
import { PROFILE_FIELDS } from "../diary/profile.mts";
import { scanScreenshots } from "../diary/screenshots.mts";
import { imageKind, imageSize } from "./assets.mts";
import { COMPANY_FIELDS } from "./company.mts";
import { loadContent } from "./content.mts";

/**
 * The work streams the report groups diary points into.
 *
 * These are deliberately generic. A stream list that names one placement's
 * subject (a recruitment board, a document service) produces a report whose
 * headings are wrong for every other student, so the built-in list describes the
 * kind of activity rather than the product, and a student whose placement is
 * shaped differently supplies their own list in `content/work-streams.json`.
 *
 * A list is `[{"id", "title", "anchors"}]`, and `anchors` are matched as whole
 * words against each accepted work point. A point matching nothing goes to a
 * catch-all stream rather than being dropped.
 */
export const DEFAULT_STREAMS = [
  {
    anchors: [
      "setup",
      "install",
      "configure",
      "environment",
      "requirement",
      "plan",
      "research",
      "read",
      "onboard",
      "learn",
    ],
    id: "setup",
    title: "Planning, Setup, and Learning",
  },
  {
    anchors: [
      "build",
      "implement",
      "add",
      "create",
      "write",
      "design",
      "develop",
      "feature",
      "screen",
      "form",
      "layout",
      "component",
    ],
    id: "build",
    title: "Building the Work",
  },
  {
    anchors: [
      "test",
      "check",
      "verify",
      "fix",
      "bug",
      "review",
      "lint",
      "build",
      "release",
      "deploy",
      "performance",
    ],
    id: "quality",
    title: "Testing, Quality, and Release",
  },
  {
    anchors: [
      "document",
      "documentation",
      "report",
      "summary",
      "present",
      "meeting",
      "data",
      "record",
      "measure",
    ],
    id: "records",
    title: "Documentation, Data, and Reporting",
  },
];

/**
 * Reads a student-supplied stream list. Every field is checked because the file
 * is written by hand, and an entry that does not parse is skipped rather than
 * allowed to break the report; an unreadable or empty file falls back to the
 * generic list.
 */
export const loadStreams = (reportRoot) => {
  const file = path.join(reportRoot, "content", "work-streams.json");
  if (!reportRoot || !existsSync(file)) {
    return DEFAULT_STREAMS;
  }
  let parsed;
  try {
    parsed = JSON.parse(readFileSync(file, "utf-8"));
  } catch {
    return DEFAULT_STREAMS;
  }
  const list = Array.isArray(parsed?.streams) ? parsed.streams : parsed;
  if (!Array.isArray(list)) {
    return DEFAULT_STREAMS;
  }
  const streams = list
    .map((entry, index) => {
      const id = String(entry?.id ?? "").trim();
      const title = String(entry?.title ?? "").trim();
      const anchors = Array.isArray(entry?.anchors)
        ? entry.anchors
            .map((anchor) => String(anchor).trim().toLowerCase())
            .filter(Boolean)
        : [];
      if (!id || !title || !anchors.length) {
        return null;
      }
      return { anchors, id: `${id}-${index}`, title };
    })
    .filter(Boolean);
  return streams.length ? streams : DEFAULT_STREAMS;
};
const textOf = (points) => (points || []).map((point) => point.text);

const pointTexts = (weeks, section) =>
  weeks.flatMap((week) => textOf(week.entry.sections[section]));

/** A point is a plain string or a saved point, so both shapes are read. */
const pointText = (point) => String(point?.text ?? point ?? "");

/**
 * A report describes the work, not the repository, so the sentences that only
 * talk about version control or a file path are not printed. This is the rule
 * `docs/REPORT-TEMPLATE.md` states for the writing; without it a student who
 * accepts the Git-derived suggestions ends up submitting a report full of branch
 * names and file paths, because the diary deliberately does print its own
 * suggestions.
 */
const REPOSITORY_LANGUAGE = new RegExp(
  [
    // Tool and workflow words.
    "\\b(?:git|github|gitlab|bitbucket|commit|commits|branch|branches|pull\\s+request|merge|merged|merging|rebase|rebased|cherry[- ]pick|checkout|stash|stashed|repository|repo|repos|diff|version control)\\b",
    // A short commit hash.
    "\\b[0-9a-f]{7,40}\\b",
    // A path with a directory part, or a bare path with a known file extension.
    "(?:^|[\\s(])[\\w.-]+(?:/[\\w.-]+)+\\.\\w{1,6}\\b",
    "\\b[\\w-]+\\.(?:ts|tsx|js|jsx|mjs|cjs|py|java|rb|go|php|cs|kt|kts|swift|vue|svelte|json|ya?ml|toml|sql|sh|bash|css|scss|html|md)\\b",
  ].join("|"),
  "iu"
);

/**
 * Drops the sentences that carry repository language and keeps the rest, so a
 * point that also describes a real outcome is not thrown away wholesale. A point
 * made up entirely of repository language leaves nothing printable, and is
 * reported to the student instead of being quietly shown as work.
 */
export const scrubRepositoryLanguage = (text) => {
  const source = pointText(text);
  const kept = [];
  const removed = [];
  for (const sentence of source.split(/(?<=[.!?])\s+/u)) {
    if (sentence.trim() && REPOSITORY_LANGUAGE.test(sentence)) {
      removed.push(sentence.trim());
    } else if (sentence.trim()) {
      kept.push(sentence.trim());
    }
  }
  return { removed, text: kept.join(" ") };
};

/**
 * Matches a whole word or phrase. A plain substring test would put "already"
 * in the familiarisation stream because it contains "read", which is exactly the
 * kind of quiet misfiling a report cannot afford.
 */
const anchorPattern = (anchor) =>
  new RegExp(
    `\\b${anchor.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`)}\\b`,
    "u"
  );

const scoreAnchors = (haystack, anchors) =>
  anchors.reduce(
    (sum, anchor) => sum + (anchorPattern(anchor).test(haystack) ? 1 : 0),
    0
  );

/**
 * Assigns each work point to a stream by counting whole-word matches. A point
 * with no match goes to a catch-all stream rather than being dropped, so no
 * accepted diary point can silently vanish from the report.
 */
export const groupWorkStreams = (weeks, streams = DEFAULT_STREAMS) => {
  const buckets = new Map();
  const unmatched = [];
  for (const week of weeks) {
    for (const point of week.entry.sections.work || []) {
      const haystack = pointText(point).toLowerCase();
      let best = null;
      let bestScore = 0;
      for (const stream of streams) {
        const score = scoreAnchors(haystack, stream.anchors);
        if (score > bestScore) {
          best = stream;
          bestScore = score;
        }
      }
      if (!best) {
        unmatched.push({ point: pointText(point), week: week.number });
        continue;
      }
      if (!buckets.has(best.id)) {
        buckets.set(best.id, { points: [], stream: best, weeks: new Set() });
      }
      const bucket = buckets.get(best.id);
      bucket.points.push(pointText(point));
      bucket.weeks.add(week.number);
    }
  }
  const ordered = streams
    .filter((stream) => buckets.has(stream.id))
    .map((stream) => ({
      points: buckets.get(stream.id).points,
      title: stream.title,
      weeks: [...buckets.get(stream.id).weeks].toSorted((a, b) => a - b),
    }));
  if (unmatched.length) {
    ordered.push({
      points: unmatched.map((item) => item.point),
      title: "Other Recorded Work",
      weeks: [...new Set(unmatched.map((item) => item.week))].toSorted(
        (a, b) => a - b
      ),
    });
  }
  return ordered;
};

const weekLabel = (weeks) => {
  if (!weeks.length) {
    return "No weeks recorded yet";
  }
  return `Weeks ${weeks[0]}-${weeks.at(-1)} of the training period`;
};

const bullets = (items) => ({ items, kind: "bullets", marker: "arrow" });

const paragraphs = (items) =>
  items.map((text) => ({ kind: "paragraph", text }));

/** Screenshots are attached to the week they were captured, not collected. */
const collectScreenshots = async (weeks) => {
  const byWeek = new Map();
  const warnings = [];
  for (const week of weeks) {
    // oxlint-disable-next-line no-await-in-loop -- each folder is scanned in week order
    const result = await scanScreenshots(week);
    if (result.images.length) {
      byWeek.set(week.number, result.images);
    }
    warnings.push(...result.errors);
  }
  return { byWeek, warnings };
};

/**
 * Assigns each week's screenshots to exactly one stream.
 *
 * A week usually has work in more than one stream, so placing images by "any
 * stream that mentions this week" would print the same screenshot several times
 * and inflate the figure count. Each week goes to the stream holding the most
 * of its work, which is the section a reader would expect to find it in.
 */
const assignScreenshots = (byWeek, streams) => {
  const assigned = new Map();
  for (const [weekNumber, images] of byWeek) {
    // The owner is the stream with the most recorded work in that week.
    const [owner] = streams
      .filter((stream) => stream.weeks.includes(weekNumber))
      .toSorted((a, b) => b.points.length - a.points.length);
    if (!owner) {
      continue;
    }
    if (!assigned.has(owner.title)) {
      assigned.set(owner.title, []);
    }
    assigned.get(owner.title).push(...images);
  }
  return assigned;
};

const figureBlocks = (images) =>
  images.map((image) => {
    const bytes = readFileSync(image.path);
    const { height, width } = imageSize(bytes);
    return {
      caption: image.caption,
      image: {
        height,
        kind: imageKind(bytes),
        path: image.path,
        width,
      },
      kind: "figure",
    };
  });

/**
 * Event photographs live beside the report assets rather than in a weekly
 * screenshot folder, so they are resolved by name and skipped when the file is
 * absent. A missing photograph must not stop the report from being written, but
 * it must not pass unnoticed either: a figure that quietly disappears looks like
 * a rendering fault, so each one is reported back to the student.
 */
const eventFigureBlocks = (file, caption, establishment, reportRoot, notes) => {
  const image = path.join(reportRoot, "assets", "organization", "events", file);
  if (!existsSync(image)) {
    notes.push(
      `Event photograph "${file}" is referenced in the report content but was not found under assets/organization/events, so no figure was printed for it.`
    );
    return [];
  }
  const bytes = readFileSync(image);
  const { height, width } = imageSize(bytes);
  return [
    {
      caption:
        caption ||
        `${establishment || "Company"} photograph from the placement`,
      image: { height, kind: imageKind(bytes), path: image, width },
      kind: "figure",
    },
  ];
};

/**
 * Charts are built from the diary's own numbers, not invented. Where there is
 * nothing to plot, the section says what would be charted and the student adds
 * the figure, rather than the report drawing a made-up graph.
 */
const workChart = (streams) => {
  if (streams.length < 2) {
    return null;
  }
  return {
    caption: "Recorded work points per work stream",
    drawing: {
      categories: streams.map((stream) => stream.title.split(" ")[0]),
      kind: "bar",
      series: [
        {
          color: 0x2f_4f_6f,
          name: "Work points",
          values: streams.map((stream) => stream.points.length),
        },
      ],
      title: "Work by stream",
    },
    kind: "drawing",
  };
};

const sectionProblemRows = (weeks) => {
  const problems = pointTexts(weeks, "problems");
  const solutions = pointTexts(weeks, "solutions");
  return problems.map((problem, index) => [
    problem,
    solutions[index] || "See the recorded solution points for this period.",
  ]);
};

/**
 * The cover prints one line for the academic home of the degree. The profile
 * keeps department, faculty, and institute apart because the daily diary needs
 * them separately, so the report joins whatever the profile actually holds.
 */
/** "1 week" and "26 weeks", never a machine count. */
const weekCount = (count) => `${count} ${count === 1 ? "week" : "weeks"}`;

/**
 * "1 month" and "6 months". The allocated length comes from the profile, because
 * a placement letter can state a number other than the NAITA default and the
 * report must not contradict the diary.
 */
const monthCount = (count) => `${count} ${count === 1 ? "month" : "months"}`;

const instituteLines = (config) =>
  [config.department, config.faculty, config.institute]
    .map((part) => String(part ?? "").trim())
    .filter(Boolean);

/**
 * Written content for one section, or the caller's placeholder when the student
 * has not written it. Prose is drawn as paragraphs; a section that is a list of
 * points, such as a self assessment, is drawn as bullets.
 */
const proseBlocks = (
  lines,
  placeholder,
  { as = "paragraphs", marker = "arrow" } = {}
) => {
  if (!lines.length) {
    return [placeholder];
  }
  return as === "bullets"
    ? [{ items: lines, kind: "bullets", marker }]
    : lines.map((text) => ({ kind: "paragraph", text }));
};

/**
 * The placement reporting line, drawn only from what the profile confirms. A
 * missing supervisor simply shortens the tree rather than inventing one.
 */
const teamTree = (config) => {
  const director = {
    children: config.teamLead
      ? [
          {
            children: [
              {
                children: [],
                label: "Team members",
                role: "Software engineers, including me",
              },
            ],
            label: "Team lead",
            role: config.teamLead,
          },
        ]
      : [],
    label: "Supervisor",
    role: config.supervisorDesignation || "",
  };
  if (!config.supervisor && !config.supervisorDesignation) {
    director.label = "Training team";
  }
  return {
    children: [director],
    label: config.establishment || "Training establishment",
    role: config.trainingLocation || "",
  };
};

/**
 * A written event section: the lead paragraphs, then each titled item with the
 * photographs the student placed under it. A photograph that is referenced but
 * not present is dropped rather than failing the whole report.
 */
const eventBlocks = (
  section,
  establishment,
  reportRoot,
  placeholder,
  notes
) => {
  if (!section.paragraphs.length && !section.items.length) {
    return [placeholder];
  }
  return [
    ...section.paragraphs.map((text) => ({ kind: "paragraph", text })),
    ...section.items.flatMap((item) => [
      { bold: true, kind: "paragraph", text: `${item.title}.` },
      ...item.paragraphs.map((text) => ({ kind: "paragraph", text })),
      ...item.figures.flatMap((figure) =>
        eventFigureBlocks(
          figure.file,
          figure.caption,
          establishment,
          reportRoot,
          notes
        )
      ),
    ]),
  ];
};

/**
 * The establishment's public facts, labelled for a reader rather than for a
 * machine: the key of a stored fact is never printed. A fact that carries a web
 * address shows it, because a reader has to be able to check where a claim came
 * from; a fact recorded from the training registration carries no address, so
 * printing "source: ..." there would only expose how the file was filled in.
 */
const companyFacts = (company) => {
  const record = company?.record || {};
  return COMPANY_FIELDS.filter((field) => record[field.key]?.value).map(
    (field) => {
      const entry = record[field.key];
      const isPublished = /^https?:\/\//u.test(entry.source || "");
      return {
        label: field.label,
        value: isPublished ? `${entry.value} (${entry.source})` : entry.value,
      };
    }
  );
};

/**
 * A recorded fact the field list does not name is a sentence rather than a
 * value, so it is written as a paragraph instead of a row with a raw key.
 */
const companyNotes = (company) => {
  const record = company?.record || {};
  const known = new Set(COMPANY_FIELDS.map((field) => field.key));
  return Object.entries(record)
    .filter(([key, entry]) => !known.has(key) && entry?.value)
    .map(([, entry]) => entry.value);
};

const hasResearch = (company) =>
  Boolean(company) && Object.keys(company.record || {}).length > 0;

/**
 * The profile fields that are still blank, read from the same field list the CLI
 * validates against. The list is never written out by hand, so a field added to
 * `PROFILE_FIELDS` is reported here without anyone remembering to add it.
 */
const missingProfileFields = (config) =>
  Object.entries(PROFILE_FIELDS)
    .filter(([key]) => !String(config[key] ?? "").trim())
    .map(([, label]) => label);

/** A visible question stands in for a fact the workspace cannot support. */
const missingResearch = () => ({
  kind: "callout",
  text: "No company research has been saved for this placement yet, so the establishment's public facts and their sources are not printed. Nothing about the establishment has been assumed in their place.",
  title: "Organization facts are missing",
});

/**
 * Builds the three chapters. Each one carries an instruction where the workspace
 * cannot support the content, so a draft never presents a plausible-sounding
 * paragraph in place of a fact the student has to supply.
 */
const buildChapters = ({
  chart,
  company,
  complete,
  config,
  content,
  notes,
  reportRoot,
  screenshots,
  streams,
}) => [
  {
    blocks: [
      ...paragraphs([
        "This chapter introduces the training establishment, its business, its organisation, and the working practices that shaped the placement. It is written so that the work described in the next chapter can be read in context, and every fact in it is either from a public source recorded with its address, or something I was able to see for myself during the placement.",
      ]),
      ...(hasResearch(company) ? [] : [missingResearch()]),
    ],
    children: [
      {
        blocks: [
          {
            kind: "keyValue",
            rows: hasResearch(company)
              ? companyFacts(company)
              : [
                  {
                    label: "Establishment",
                    value: config.establishment || "Not recorded yet",
                  },
                ],
          },
          ...(hasResearch(company) ? paragraphs(companyNotes(company)) : []),
          ...(missingProfileFields(config).length
            ? [
                {
                  kind: "callout",
                  text: `These profile fields are not recorded yet, so they are left out of this report rather than filled in: ${missingProfileFields(config).join(", ")}.`,
                  title: "Profile fields still blank",
                },
              ]
            : []),
        ],
        children: [
          {
            blocks: proseBlocks(content.natureOfBusiness, {
              kind: "placeholder",
              note: "This section is not written yet. It covers what the establishment does, who it does it for, and the public source each fact came from.",
            }),
            title: "Nature of the Business",
          },
          {
            blocks: [
              ...proseBlocks(content.organisationStructure, {
                kind: "placeholder",
                note: "This section is not written yet. It covers the team structure as it was actually seen, naming only people and teams that could be confirmed.",
              }),
              ...(content.organisationStructure.length
                ? [
                    {
                      caption: "Team structure during the placement",
                      drawing: {
                        kind: "orgTree",
                        title: "Placement team structure",
                        tree: teamTree(config),
                      },
                      kind: "drawing",
                    },
                  ]
                : []),
            ],
            title: "Organisation Structure",
          },
        ],
        title: `About ${config.establishment || "the Training Establishment"}`,
      },
      {
        blocks: proseBlocks(content.managementPractices, {
          kind: "placeholder",
          note: "This section is not written yet. It covers the working practices observed during the placement: how work is planned and reviewed, how quality is checked, and how access to systems and data is controlled.",
        }),
        title: "Management Practices",
      },
    ],
    introTitle: "Introduction",
    title: "Training Organization",
  },
  {
    blocks: paragraphs([
      "This chapter describes the training itself. The diary weeks are the evidence base, but they are grouped into work streams here so the report reads as an account of the placement rather than a list of weeks. Each stream explains what the work was, what it changed, and how it was checked.",
      `The training covered ${weekCount(complete.length)} from ${config.trainingStart || "the start date"} to ${config.trainingEnd || "the end date"}. The placement was allocated for ${monthCount(allocatedMonthCount(config))}, which is where the diary ends.`,
    ]),
    children: [
      {
        blocks: proseBlocks(content.placementIntroduction, {
          kind: "placeholder",
          note: "This section is not written yet. It covers how the placement was arranged: the start date, the induction, the first change, and who supervised the work.",
        }),
        title: "Introduction to the Placement",
      },
      {
        blocks: [
          ...proseBlocks(content.learningPeriod, {
            kind: "placeholder",
            note: "This section is not written yet. It covers the technical foundations learned before any feature was assigned, and what each was actually used for.",
          }),
          ...(pointTexts(complete, "learning").length
            ? [
                {
                  items: pointTexts(complete, "learning").slice(0, 8),
                  kind: "bullets",
                  marker: "arrow",
                },
              ]
            : []),
        ],
        title: "Learning Period",
      },
      {
        blocks: [
          {
            kind: "paragraph",
            text: "The work below is grouped by what was being built, not by week. Figures sit inside the stream they belong to, so a reader meets the screenshot where it is explained rather than in a block at the end of the chapter.",
          },
          ...(chart ? [chart] : []),
        ],
        children: streams.map((stream) => ({
          blocks: [
            {
              kind: "paragraph",
              text: `This work was recorded across ${weekCount(stream.weeks.length)}: ${weekLabel(stream.weeks)}.`,
            },
            bullets(stream.points),
            // Each week's screenshots appear in one stream only, so a figure is
            // never printed twice under two different headings.
            ...figureBlocks(screenshots.get(stream.title) || []),
          ],
          title: stream.title,
        })),
        title: "Assigned Tasks",
      },
      {
        blocks: [
          {
            kind: "paragraph",
            text: "A problem recorded without its cause teaches nothing, and a fix without its cause cannot be repeated. The table below pairs the problems recorded in the diary with the solutions recorded against them. Where the diary has a problem but no matching solution, that gap is shown rather than filled in.",
          },
          ...(sectionProblemRows(complete).length
            ? [
                {
                  caption:
                    "Problems recorded in the diary and the solutions recorded against them",
                  columns: [
                    { header: "Problem", weight: 1 },
                    { header: "Solution", weight: 1 },
                  ],
                  kind: "table",
                  rows: sectionProblemRows(complete).slice(0, 12),
                },
              ]
            : [
                {
                  kind: "callout",
                  text: "No problems have been recorded during the placement yet, so there is nothing to pair with a solution. The table is written from the problems and solutions recorded in the diary.",
                  title: "Nothing to show yet",
                },
              ]),
        ],
        title: "Problems and Solutions",
      },
      {
        blocks: [
          {
            kind: "paragraph",
            text: "This section lists work that was completed and can be pointed at. Learning that has not been applied yet is kept separate, in the next section, because an intention written as an achievement is the easiest way for a report to become inaccurate.",
          },
          ...(pointTexts(complete, "work").length
            ? [bullets(pointTexts(complete, "work").slice(0, 20))]
            : [
                {
                  kind: "callout",
                  text: "No completed work has been recorded during the placement yet, so this section is empty rather than filled in from unaccepted suggestions.",
                  title: "Nothing to show yet",
                },
              ]),
        ],
        title: "Achievements",
      },
      {
        blocks: eventBlocks(
          content.events,
          config.establishment,
          reportRoot,
          {
            kind: "placeholder",
            note: "This section is not written yet. It covers the non-technical experience of the placement: training days, safety briefings, knowledge sharing sessions, and events attended.",
          },
          notes
        ),
        title: "Events Involved",
      },
      {
        blocks: [
          ...(pointTexts(complete, "improvements").length
            ? [bullets(pointTexts(complete, "improvements").slice(0, 12))]
            : []),
          {
            kind: "callout",
            text: "This section is for learning that has not been applied yet and for what would be done differently. It must not repeat the achievements section, and nothing in it may claim work that was completed.",
            title: "Learning kept separate from completed work",
          },
        ],
        title: "Learning and Improvements for Future Work",
      },
    ],
    introTitle: "Introduction",
    title: "Training Experience",
  },
  {
    blocks: paragraphs([
      "This chapter closes the report. It summarises what the training produced, sets out an honest self-assessment, and records what would be done differently or continued afterwards.",
    ]),
    children: [
      {
        blocks: proseBlocks(content.conclusion, {
          kind: "placeholder",
          note: "This section is not written yet. It states what the training produced, which habit mattered most, and what the work delivered shows about the level reached.",
        }),
        title: "Conclusion of the Report",
      },
      {
        blocks: [
          {
            kind: "paragraph",
            text: "This is my own assessment of where I had reached by the end of the placement. I have written it to be useful rather than flattering, because an assessment that claims no weaknesses cannot be acted on.",
          },
        ],
        children: [
          {
            blocks: proseBlocks(
              content.strengths,
              {
                kind: "placeholder",
                note: "This section is not written yet. It holds the strengths that can be stated with confidence.",
              },
              { as: "bullets", marker: "dot" }
            ),
            title: "Strengths",
          },
          {
            blocks: proseBlocks(
              content.weaknesses,
              {
                kind: "placeholder",
                note: "This section is not written yet. It holds the weaknesses worth naming honestly.",
              },
              { as: "bullets", marker: "dot" }
            ),
            title: "Weaknesses",
          },
          {
            blocks: proseBlocks(
              content.opportunities,
              {
                kind: "placeholder",
                note: "This section is not written yet. It holds the opportunities worth taking on next.",
              },
              { as: "bullets", marker: "dot" }
            ),
            title: "Opportunities",
          },
          {
            blocks: proseBlocks(
              content.threats,
              {
                kind: "placeholder",
                note: "This section is not written yet. It holds what could go wrong and how it would be reduced.",
              },
              { as: "bullets", marker: "dot" }
            ),
            title: "Threats to Development",
          },
        ],
        title: "Personal SWOT Analysis",
      },
      {
        blocks: proseBlocks(
          content.suggestions,
          {
            kind: "placeholder",
            note: "This section is not written yet. It holds suggestions for improving the placement, the work, or the way it was handed over.",
          },
          { as: "bullets", marker: "dot" }
        ),
        title: "Suggestions for Improvement",
      },
    ],
    introTitle: "Introduction",
    title: "Conclusion",
  },
];

// The cover prints the establishment's own address under its name and the
// placement's location further down, so the two must not be the same value.
/**
 * The cover carries the address the placement was actually carried out at. A
 * public listing of the registered address is a second, different address, so it
 * is only used when the worksite address is not known.
 */
const buildCover = (config, company, fallbackAddress) => {
  const researchedAddress = company?.record?.address?.value;
  const researchedPlace = company?.record?.headquarters?.value;
  const establishmentAddress = config.trainingLocation
    ? ""
    : researchedAddress || researchedPlace || fallbackAddress;
  return {
    category: config.category,
    course: config.course,
    establishment: config.establishment || "[ESTABLISHMENT NOT RECORDED]",
    establishmentAddress,
    field: config.field,
    instituteLines: instituteLines(config),
    naitaRegistration: config.naitaRegistration,
    name: config.name || "[NAME NOT RECORDED]",
    studentNumber: config.studentNumber,
    trainingEnd: config.trainingEnd || "[END DATE NOT RECORDED]",
    trainingLocation: config.trainingLocation,
    trainingStart: config.trainingStart || "[START DATE NOT RECORDED]",
  };
};

/**
 * Rewrites the weeks the report draws from so no point can print repository
 * language, and collects what was held back. The diary file on disk is never
 * changed: this only affects the document being written, so the student keeps the
 * original wording and can rewrite it deliberately.
 */
const scrubWeeks = (weeks) => {
  const held = [];
  const cleaned = weeks.map((week) => {
    const sections = {};
    for (const [section, points] of Object.entries(week.entry.sections)) {
      sections[section] = points.map((point) => {
        const { removed, text } = scrubRepositoryLanguage(point);
        for (const sentence of removed) {
          held.push({
            point: text || pointText(point),
            section,
            sentence,
            week: week.number,
          });
        }
        return { ...point, text };
      });
    }
    return { ...week, entry: { ...week.entry, sections } };
  });
  return { held, weeks: cleaned };
};

export const buildReportFromDiary = async (diary, options = {}) => {
  const { config, weeks } = diary;
  const reportRoot = options.reportRoot || "";
  const content = loadContent(reportRoot);
  const { held, weeks: clean } = scrubWeeks(
    weeks.filter((week) =>
      ["work", "problems", "solutions", "learning", "improvements"].some(
        (section) => textOf(week.entry.sections[section]).length
      )
    )
  );
  const complete = clean;
  const streams = groupWorkStreams(complete, loadStreams(reportRoot));
  const { byWeek, warnings } = await collectScreenshots(weeks);
  const chart = workChart(streams);
  const screenshots = assignScreenshots(byWeek, streams);
  const { company } = options;
  const photoNotes = [];
  const repositoryLanguage = held.map(
    (note) =>
      `Week ${note.week} ${note.section}: "${note.sentence}" is repository language, so it was not printed. Rewrite the diary point to describe the change and who it was for.`
  );

  const document = {
    abbreviations: options.abbreviations || content.abbreviations,
    acknowledgement: options.acknowledgement || content.acknowledgement,
    chapters: buildChapters({
      chart,
      company,
      complete,
      config,
      content,
      notes: photoNotes,
      reportRoot,
      screenshots,
      streams,
    }),
    cover: buildCover(config, company, options.establishmentAddress),
    preface: options.preface || content.preface,
    references: options.references || content.references,
    title: "Report on Industrial Training",
  };
  if (options.certification !== false) {
    document.certification = {
      declaration:
        "I hereby declare that I have checked this report on the industrial training, and that, to my knowledge, it contains only the activities carried out during the placement and is adequate in scope and quality for submission as partial fulfilment of the degree.",
      fields: [
        { label: "Name", value: config.supervisor || "" },
        { label: "Designation", value: config.supervisorDesignation || "" },
        { label: "Date", value: "" },
      ],
      title: "Supervisor Certification",
    };
  }
  return {
    document,
    repositoryLanguage,
    warnings: [...warnings, ...photoNotes],
  };
};
