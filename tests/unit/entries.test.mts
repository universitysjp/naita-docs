import { describe, expect, it } from "vitest";

import {
  baselineSuggestions,
  mergeSuggestions,
  resolveSuggestion,
  validateAgentResponse,
} from "../../src/ai/suggestions.mts";
import { parseArgs } from "../../src/cli/args.mts";
import { calendar } from "../../src/diary/dates.mts";
import {
  blankWeek,
  describeCommit,
  editPoint,
  dailyPoints,
  cleanText,
} from "../../src/diary/entries.mts";
import { PROFILE } from "../helpers/fixtures.mts";

const sample = () => {
  const [week] = calendar(PROFILE, [
    {
      date: "2026-04-06",
      hash: "full-hash",
      subject: "feat(search): add a search box",
    },
  ]);
  return { ...week, entry: blankWeek(week) };
};
describe("weekly points and suggestions", () => {
  it("writes plain past-tense commit descriptions without guessing outcomes", () => {
    expect(describeCommit("feat(search): add a search box")).toBe(
      "Added a search box."
    );
    expect(describeCommit("fix: handle empty results")).toBe(
      "Handled empty results."
    );
    expect(() => cleanText("   ")).toThrow();
  });
  it("inserts, edits, and removes one point without moving neighbouring entries", () => {
    const { entry } = sample();
    editPoint(entry, { section: "work", text: "First." });
    editPoint(entry, { section: "work", text: "Third." });
    const third = entry.sections.work[1].id;
    editPoint(entry, { before: third, section: "work", text: "Second." });
    expect(entry.sections.work.map((point) => point.text)).toEqual([
      "First.",
      "Second.",
      "Third.",
    ]);
    editPoint(entry, { id: third, section: "work", text: "Last." });
    expect(entry.sections.work[2].id).toBe(third);
    editPoint(entry, { id: third, remove: true, section: "work" });
    expect(entry.sections.work).toHaveLength(2);
    expect(() =>
      editPoint(entry, { before: "missing", section: "work", text: "Oops" })
    ).toThrow();
    expect(() =>
      editPoint(entry, { section: "__proto__", text: "Oops" })
    ).toThrow();
  });
  it("keeps proposals out of diary entries and requires answers to experience questions", () => {
    const week = sample();
    const suggestions = baselineSuggestions(week);
    mergeSuggestions(week.entry, suggestions);
    mergeSuggestions(week.entry, suggestions);
    expect(week.entry.suggestions).toHaveLength(5);
    expect(week.entry.sections.work).toEqual([]);
    const question = suggestions.find((item) => item.section === "problems");
    expect(() => resolveSuggestion(week.entry, question.id)).toThrow(/Answer/u);
    resolveSuggestion(week.entry, question.id, {
      text: "The list was blank after clearing the search.",
    });
    resolveSuggestion(week.entry, suggestions[0].id);
    mergeSuggestions(week.entry, suggestions);
    expect(week.entry.sections.work[0].text).toBe("Added a search box.");
    expect(week.entry.sections.problems).toHaveLength(1);
    expect(week.entry.suggestions).toHaveLength(3);
  });
  it("does not use work text on medical dates or fabricate missing work", () => {
    const week = sample();
    expect(dailyPoints(week.days[1], week.entry)).toEqual([]);
    const day = { ...week.days[0], status: "medical" };
    week.entry.days[day.date] = [{ text: "Some work" }];
    expect(dailyPoints(day, week.entry)).toEqual([{ text: "Medical leave." }]);
  });
  it("validates the whole agent response before applying suggestions", () => {
    const week = sample();
    const result = {
      weeks: [
        {
          monday: week.monday,
          suggestions: [
            {
              evidence: ["full-hash"],
              kind: "draft",
              reason: "The commit records the change.",
              section: "work",
              text: "Added search.",
            },
          ],
        },
      ],
    };
    expect(validateAgentResponse(result, [week])[0].suggestions[0].text).toBe(
      "Added search."
    );
    result.weeks[0].suggestions[0].evidence = ["unrelated"];
    expect(() => validateAgentResponse(result, [week])).toThrow(/outside/u);
    result.weeks[0].suggestions[0].evidence = [];
    expect(() => validateAgentResponse(result, [week])).toThrow(/cite Git/u);
    result.weeks[0].monday = "2026-05-04";
    expect(() => validateAgentResponse(result, [week])).toThrow(/unknown/u);
  });
  it("parses repeated repositories, empty date lists, and rejects typos", () => {
    expect(
      parseArgs(["import", "--repo", "a path", "--repo", "b", "--leave", ""])
        .options
    ).toMatchObject({
      leave: "",
      repo: ["a path", "b"],
    });
    expect(() => parseArgs(["generate", "--levae", "2026-04-10"])).toThrow();
    expect(() => parseArgs(["add", "--text"])).toThrow();
    expect(parseArgs(["export", "--strict"]).command).toBe("generate");
  });
});
