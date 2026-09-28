import path from "node:path";

import { cleanText, stableId } from "./entries.mts";

// These are capture ideas, not claims about available screens or test results.
const captureIdea = (text) => {
  if (
    /\b(?<testing>test|tests|testing|spec|coverage|checks|ci|pipeline)\b/iu.test(
      text
    )
  ) {
    return "Capture the relevant test/check output with its command and actual result visible. Do not describe it as passing unless it did.";
  }
  if (
    /\b(?<backend>api|endpoint|request|response|backend|server)\b/iu.test(text)
  ) {
    return "Capture a relevant request and its response, or the backend output demonstrating this change. Hide tokens and private data.";
  }
  if (/\b(?<data>sql|database|schema|migration|query)\b/iu.test(text)) {
    return "Capture the relevant schema, migration, or query and its result using non-sensitive sample data.";
  }
  if (/\b(?<listing>search|filter|filtering)\b/iu.test(text)) {
    return "Capture the search/filter input and the resulting list or output for this change. Include an empty-result case only if it is relevant and reproducible.";
  }
  if (
    /\b(?<written>docs|documentation|readme|guide|research|design|meeting|discussed|reviewed)\b/iu.test(
      text
    )
  ) {
    return "If shareable, capture the relevant document, design, or notes supporting this activity. If it has no suitable visual evidence, explain why screenshots are not needed.";
  }
  if (
    /\b(?<interface>ui|screen|page|form|button|layout|dashboard|frontend|style|css)\b/iu.test(
      text
    )
  ) {
    return "Capture the affected screen or component with this change visible and enough context to identify it.";
  }
  if (
    /\b(?<release>install|setup|configure|configuration|build|deploy|deployment)\b/iu.test(
      text
    )
  ) {
    return "Capture the relevant setup/build/deployment output or configuration with its actual result visible. Hide credentials and environment secrets.";
  }
  return "Capture the relevant work result or code/output demonstrating this activity. Choose the view yourself; the Git message does not establish a particular screen.";
};

export const screenshotIdeas = (week) => {
  const candidates = new Map();
  for (const day of week.days.filter((weekday) => weekday.status === "work")) {
    for (const commit of day.commits) {
      const activity = cleanText(commit.subject.slice(0, 1000));
      const key = `git:${activity.toLowerCase()}:${[...commit.repos].toSorted().join("|")}`;
      const candidate = candidates.get(key);
      if (candidate) {
        candidate.evidence.push(commit.hash);
        if (!candidate.dates.includes(day.date)) {
          candidate.dates.push(day.date);
        }
      } else {
        candidates.set(key, {
          activity,
          dates: [day.date],
          evidence: [commit.hash],
          id: stableId(key),
          repos: commit.repos,
          source: "git",
        });
      }
    }
  }
  const manual = [
    ...week.entry.sections.work.map((point) => ({ date: null, point })),
    ...week.days
      .filter((day) => day.status === "work")
      .flatMap((day) =>
        week.entry.days[day.date].map((point) => ({ date: day.date, point }))
      ),
  ];
  for (const { point, date } of manual) {
    // Accepted Git drafts are already covered by their commits. Student edits
    // and activities with no commit still need their own capture guidance.
    if (point.source !== "manual" && point.evidence?.length) {
      continue;
    }
    if (point.source === "git") {
      continue;
    }
    const key = `manual:${point.id}`;
    candidates.set(key, {
      activity: cleanText(point.text).slice(0, 1000),
      dates: date ? [date] : [],
      evidence: point.evidence || [],
      id: stableId(key),
      pointId: point.id,
      repos: [],
      source: "manual",
    });
  }
  return [...candidates.values()].map((idea) => {
    const slug =
      idea.activity
        .toLowerCase()
        .replaceAll(/[^a-z0-9]+/gu, "-")
        .replaceAll(/^-|-$/gu, "")
        .slice(0, 45) || "work";
    const filename = `${idea.dates[0] || week.monday}-${slug}-${idea.id.slice(0, 8)}.png`;
    return {
      ...idea,
      capture: captureIdea(idea.activity),
      filename,
      optional: true,
      path: path.join(week.screenshotFolder, filename),
    };
  });
};
