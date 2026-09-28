/* oxlint-disable vitest/prefer-importing-vitest-globals --
   This file runs under `bun test`, not Vitest. It is excluded from
   vitest.config.mts and must import its runner from bun:test. */
import { afterEach, expect, test } from "bun:test";

import type { TestRendererSetup } from "@opentui/core/testing";
import { createTestRenderer } from "@opentui/core/testing";

import { execute } from "../../src/cli/main.mts";
import { loadDiary, loadProfile } from "../../src/diary/store.mts";
import { createDiaryApp } from "../../src/tui/app";
import { cliClient } from "../../src/tui/client";
import { fixture, PROFILE, seedRepo } from "../helpers/fixtures.mts";

let setup: TestRendererSetup;
let context: ReturnType<typeof fixture>;
afterEach(() => {
  setup?.renderer.destroy();
  context?.cleanup();
});

/* oxlint-enable vitest/prefer-importing-vitest-globals */
const frameContaining = async (text: string) => {
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    // Each frame is rendered in sequence; the poll is what advances the UI.
    // oxlint-disable-next-line no-await-in-loop -- sequential render polling
    await setup.renderOnce();
    const frame = setup.captureCharFrame();
    if (frame.includes(text)) {
      return frame;
    }
    /* oxlint-disable promise/avoid-new, no-await-in-loop --
       a plain timer poll; Bun and Node both provide a promise-based sleep. */
    await new Promise((resolve) => {
      setTimeout(resolve, 20);
    });
    /* oxlint-enable promise/avoid-new, no-await-in-loop */
  }
  throw new Error(
    `Frame did not contain ${text}:\n${setup.captureCharFrame()}`
  );
};

test("edits a profile and a weekly point through real keyboard events and CLI persistence", async () => {
  context = fixture({ ...PROFILE, name: "" });
  setup = await createTestRenderer({ height: 30, width: 100 });
  const app = createDiaryApp(setup.renderer, cliClient(context.workspace));
  await app.start();
  await frameContaining("Choose any step");
  setup.mockInput.pressEnter();
  await frameContaining("Select any field");
  setup.mockInput.pressEnter();
  await frameContaining("Student name (1/1)");
  await setup.mockInput.typeText("Test Student", 1);
  setup.mockInput.pressEnter();
  await frameContaining("Select any field");
  expect(loadProfile(context.workspace).name).toBe("Test Student");
  setup.mockInput.pressEscape();
  await frameContaining("Choose any step");
  setup.mockInput.pressArrow("down");
  setup.mockInput.pressEnter();
  await frameContaining("Choose a week");
  setup.mockInput.pressEnter();
  await frameContaining("Work carried out (0 points)");
  setup.mockInput.pressEnter();
  await frameContaining("Each entry is a bullet point");
  setup.mockInput.pressEnter();
  await frameContaining("Add a point (1/1)");
  await setup.mockInput.pasteBracketedText(
    "Added a search box to help users find a task."
  );
  setup.mockInput.pressEnter();
  await frameContaining("Each entry is a bullet point");
  expect(
    loadDiary(context.workspace).weeks[0].entry.sections.work[0].text
  ).toBe("Added a search box to help users find a task.");
  setup.resize(80, 24);
  await setup.renderOnce();
  expect(setup.captureCharFrame()).toContain("Esc: back");
  setup.mockInput.pressEscape();
  await frameContaining("Work carried out (1 points)");
  setup.mockInput.pressCtrlC();
  expect(setup.renderer.isDestroyed).toBe(true);
}, 30_000);

test("shows validation errors and allows Escape out of a form without saving", async () => {
  context = fixture();
  setup = await createTestRenderer({ height: 28, width: 90 });
  const app = createDiaryApp(setup.renderer, cliClient(context.workspace));
  await app.start();
  setup.mockInput.pressArrow("down");
  setup.mockInput.pressArrow("down");
  setup.mockInput.pressEnter();
  await frameContaining("Path to the Git repository");
  setup.mockInput.pressEnter();
  await frameContaining("is required");
  await setup.mockInput.typeText("/not-a-repository", 1);
  setup.mockInput.pressEnter();
  await frameContaining("Your Git author name");
  setup.mockInput.pressEscape();
  await frameContaining("Path to the Git repository");
  expect(setup.captureCharFrame()).toContain("/not-a-repository");
  setup.mockInput.pressEscape();
  await frameContaining("Choose any step");
  expect(loadDiary(context.workspace).state.repos).toEqual([]);
}, 15_000);

test("opens the screenshots-last checklist and a week-specific capture idea with real keyboard events", async () => {
  context = fixture();
  seedRepo(context.repo);
  await execute("import", { repo: context.repo, workspace: context.workspace });
  setup = await createTestRenderer({ height: 32, width: 110 });
  const app = createDiaryApp(setup.renderer, cliClient(context.workspace));
  await app.start();
  for (let index = 0; index < 4; index += 1) {
    setup.mockInput.pressArrow("down");
  }
  setup.mockInput.pressEnter();
  await frameContaining("Checklist | screenshots last");
  expect(setup.captureCharFrame()).toContain("CHECKLIST.md");
  // Seven overall tasks precede the weekly capture guides.
  for (let index = 0; index < 7; index += 1) {
    setup.mockInput.pressArrow("down");
  }
  setup.mockInput.pressEnter();
  await frameContaining("Week 1 | Screenshot checklist");
  expect(setup.captureCharFrame()).toContain("week-01-2026-04-06");
  // Ten weekly tasks precede optional evidence-based capture ideas.
  for (let index = 0; index < 10; index += 1) {
    setup.mockInput.pressArrow("down");
  }
  setup.mockInput.pressEnter();
  await frameContaining("What to capture (optional)");
  expect(setup.captureCharFrame()).toContain("search/filter input");
  expect(setup.captureCharFrame()).toContain("Suggested filename:");
  setup.mockInput.pressEscape();
  await frameContaining("Week 1 | Screenshot checklist");
}, 30_000);
