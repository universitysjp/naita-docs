import { once } from "node:events";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";

import { test, expect } from "@playwright/test";

import { fixture, seedRepo, cli, ROOT } from "../helpers/fixtures.mts";

const ARTIFACTS = path.join(ROOT, "output/playwright");
const outputPdf = path.join(ARTIFACTS, "diary-e2e.pdf");
let context;
let server;
let baseURL;

test.beforeAll(async () => {
  mkdirSync(ARTIFACTS, { recursive: true });
  context = fixture();
  seedRepo(context.repo);
  server = createServer((request, response) => {
    const files = {
      "/": [path.join(ROOT, "tests/fixtures/pdf-viewer.html"), "text/html"],
      "/diary.pdf": [outputPdf, "application/pdf"],
      "/pdf.mjs": [
        path.join(ROOT, "node_modules/pdfjs-dist/build/pdf.mjs"),
        "text/javascript",
      ],
      "/pdf.worker.mjs": [
        path.join(ROOT, "node_modules/pdfjs-dist/build/pdf.worker.mjs"),
        "text/javascript",
      ],
    };
    const file = files[request.url];
    if (!file) {
      response.writeHead(404);
      response.end();
      return;
    }
    try {
      response.writeHead(200, {
        "Cache-Control": "no-store",
        "Content-Type": file[1],
      });
      response.end(readFileSync(file[0]));
    } catch {
      response.writeHead(500);
      response.end("Could not read test fixture");
    }
  });
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  baseURL = `http://127.0.0.1:${server.address().port}`;
});
test.afterAll(async () => {
  if (server) {
    server.close();
    await once(server, "close");
  }
  context?.cleanup();
});

const goToPdfPage = async (page, number) => {
  await page.getByRole("spinbutton", { name: "Page" }).fill(String(number));
  await page.getByRole("spinbutton", { name: "Page" }).press("Tab");
  await expect(page.locator("#state")).toHaveText(`Rendered page ${number}`);
};

test("CLI-to-PDF workflow: two weeks, reviewed points, manual edits, PNG/JPEG screenshots, and browser rendering", async ({
  page,
}, testInfo) => {
  const { workspace } = context;
  cli(workspace, "import", {
    leave: "2026-04-10",
    medical: "2026-04-17",
    off: "2026-04-08..2026-04-09,2026-04-14..2026-04-16",
    repo: context.repo,
  });
  cli(workspace, "draft");
  for (const number of [1, 2]) {
    cli(workspace, "accept", { "accept-drafts": true, week: number });
    const week = cli(workspace, "show", { week: number });
    const answers = {
      improvements:
        "Next week, I would write down the empty-input case before changing the filter.",
      learning:
        "Learned to check both the search result and what happens when the input is cleared.",
      problems:
        number === 1
          ? "The task list stayed blank after the search text was cleared."
          : "The filtering check did not cover an empty query.",
      solutions:
        number === 1
          ? "Reset the filter when the search text was cleared and checked the full list appeared again."
          : "Added a check for an empty query and ran the filtering tests.",
    };
    for (const suggestion of week.entry.suggestions) {
      cli(workspace, "accept", {
        id: suggestion.id,
        text: answers[suggestion.section],
        week: number,
      });
    }
    // This is an explicitly labelled test fixture, not evidence of real internship work.
    // oxlint-disable-next-line no-await-in-loop
    await page.setContent(
      `<main style="padding:40px;font:20px system-ui;background:#f3f6fc;min-height:240px"><p>Diary test fixture - Week ${number}</p><h1>Task list</h1><label>Find a task <input value="search" /></label><p>Search result: Add a task search box</p><p>Empty input restores the full list.</p></main>`
    );
    const imageName = number === 1 ? "01-search.png" : "01-filter-check.jpg";
    // oxlint-disable-next-line no-await-in-loop
    await page.locator("main").screenshot({
      path: path.join(week.screenshotFolder, imageName),
      type: number === 1 ? "png" : "jpeg",
    });
    cli(workspace, "screenshots", {
      file: imageName,
      text: `Week ${number}: sample task list used to test diary screenshots`,
      week: number,
    });
    const ready = cli(workspace, "status", { week: number });
    expect(ready.weeks[0], JSON.stringify(ready.weeks[0])).toMatchObject({
      conflicts: [],
      percent: 100,
      suggestions: 0,
    });
    cli(workspace, "review", { week: number });
  }
  expect(cli(workspace, "status").complete).toBe(true);
  const before = cli(workspace, "show", { week: 1 });
  cli(workspace, "add", {
    before: before.entry.sections.work[1].id,
    section: "work",
    text: "Checked the search box with a task title and with an empty input.",
    week: 1,
  });
  expect(cli(workspace, "status").weeks[0].reviewed).toBe(false);
  // Exercise ordinary manual JSON editing followed by another Git import.
  const saved = JSON.parse(readFileSync(before.file, "utf-8"));
  saved.sections.learning[0].text =
    "Learned why clearing a search should bring back the full task list.";
  writeFileSync(before.file, JSON.stringify(saved, null, 2));
  cli(workspace, "import", { repo: context.repo });
  expect(
    cli(workspace, "show", { week: 1 }).entry.sections.learning[0].text
  ).toBe(saved.sections.learning[0].text);
  cli(workspace, "review", { week: 1 });
  const result = cli(workspace, "generate", { out: outputPdf, strict: true });
  expect(result.pages).toBe(11);
  const checklist = cli(workspace, "checklist");
  expect(checklist.complete).toBe(true);
  expect(checklist.tasks.every((task) => task.done)).toBe(true);
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.message));
  await page.goto(baseURL);
  await expect(page.locator("#state")).toHaveText("Rendered page 1");
  await goToPdfPage(page, 2);
  await expect(page.locator("#pdf-text")).toContainText("Sample Trainee");
  await page
    .locator("canvas")
    .screenshot({ path: path.join(ARTIFACTS, "profile.png") });
  await goToPdfPage(page, 3);
  await expect(page.locator("#pdf-text")).toContainText("Authorized leave.");
  await page
    .locator("canvas")
    .screenshot({ path: path.join(ARTIFACTS, "week-1-daily.png") });
  await goToPdfPage(page, 4);
  await expect(page.locator("#pdf-text")).toContainText(
    "Learned why clearing a search should bring back the full task list."
  );
  await expect(page.locator("#pdf-text")).toContainText(
    "Improvements for next week"
  );
  const overlay = await page.evaluate(() =>
    window.pageItems
      .filter((item) =>
        /Learned why|Checked the search|Reset the filter/u.test(item.str)
      )
      .map((item) => ({
        text: item.str,
        width: item.width,
        x: item.transform[4],
        y: item.transform[5],
      }))
  );
  expect(overlay.length).toBeGreaterThan(0);
  for (const item of overlay) {
    expect(item.x).toBeGreaterThanOrEqual(84);
    expect(item.x + item.width).toBeLessThanOrEqual(526);
    expect(item.y).toBeGreaterThanOrEqual(155);
  }
  await page
    .locator("canvas")
    .screenshot({ path: path.join(ARTIFACTS, "week-1-notes.png") });
  await goToPdfPage(page, 5);
  await expect(page.locator("#pdf-text")).toContainText(
    "Week 1: sample task list"
  );
  await expect(page.locator("#pdf-text")).toContainText(
    "REMARKS AND CERTIFICATION"
  );
  const nonWhite = await page.locator("canvas").evaluate((canvas) => {
    const { data } = canvas.getContext("2d").getImageData(110, 135, 500, 350);
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i] < 180 && data[i + 1] < 180 && data[i + 2] < 180) {
        dark += 1;
      }
    }
    return dark;
  });
  expect(nonWhite).toBeGreaterThan(500);
  await page
    .locator("canvas")
    .screenshot({ path: path.join(ARTIFACTS, "week-1-screenshots.png") });
  await goToPdfPage(page, 7);
  await expect(page.locator("#pdf-text")).toContainText(
    "The filtering check did not cover an empty query."
  );
  await expect(page.locator("#pdf-text")).not.toContainText(
    "The task list stayed blank"
  );
  await goToPdfPage(page, 8);
  await expect(page.locator("#pdf-text")).toContainText(
    "Week 2: sample task list"
  );
  await page
    .locator("canvas")
    .screenshot({ path: path.join(ARTIFACTS, "week-2-screenshots.png") });
  expect(browserErrors).toEqual([]);
  await testInfo.attach("Generated diary", {
    contentType: "application/pdf",
    path: outputPdf,
  });
});
