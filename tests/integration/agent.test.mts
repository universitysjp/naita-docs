import { readFileSync } from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { agentPrompt } from "../../src/ai/prompt.mts";
import { runAgent } from "../../src/ai/runner.mts";
import { execute } from "../../src/cli/main.mts";
import { loadDiary, saveWeek } from "../../src/diary/store.mts";
import { draftWeeks } from "../../src/diary/workflow.mts";
import { run } from "../../src/runtime/process.mts";
import { fixture, seedRepo, ROOT, cli } from "../helpers/fixtures.mts";

// The adapter is executed from the workspace. Quote fixed fixture paths as
// shell arguments; no diary content is ever interpolated into the command.
const quote = (value) =>
  process.platform === "win32"
    ? `"${value}"`
    : `'${value.replaceAll("'", "'\\''")}'`;

let context;
afterEach(() => context?.cleanup());

it("passes evidence on stdin, imports proposals, and preserves edits made while the agent runs", async () => {
  context = fixture();
  seedRepo(context.repo);
  await execute("import", { repo: context.repo, workspace: context.workspace });
  await execute("add", {
    section: "work",
    text: "Original student note.",
    week: "1",
    workspace: context.workspace,
  });
  const command = `${quote(process.execPath)} ${quote(path.resolve(ROOT, "tests/fixtures/mock-agent.mts"))}`;
  const pending = draftWeeks(context.workspace, {
    "agent-command": command,
    week: "1",
  });
  const [week] = loadDiary(context.workspace).weeks;
  week.entry.sections.work[0].text =
    "Student changed this while waiting for the agent.";
  saveWeek(context.workspace, week);
  await pending;
  const [latest] = loadDiary(context.workspace).weeks;
  expect(latest.entry.sections.work[0].text).toBe(
    "Student changed this while waiting for the agent."
  );
  expect(latest.entry.suggestions[0].text).toBe("Added a task search box.");
  const throughBun = cli(context.workspace, "draft", {
    "agent-command": command,
    week: "1",
  });
  expect(throughBun.weeks[0].suggestions[0].text).toBe(
    "Added a task search box."
  );
});

it("reports non-zero exits and malformed JSON without altering the diary", async () => {
  context = fixture();
  seedRepo(context.repo);
  await execute("import", { repo: context.repo, workspace: context.workspace });
  const diary = loadDiary(context.workspace);
  const before = readFileSync(diary.weeks[0].file, "utf-8");
  const prompt = agentPrompt(diary.weeks);
  await expect(
    runAgent(
      { "agent-command": "bun run tests/fixtures/mock-agent.mts fail" },
      prompt,
      ROOT
    )
  ).rejects.toThrow(/Deliberate/u);
  await expect(
    runAgent(
      { "agent-command": "bun run tests/fixtures/mock-agent.mts malformed" },
      prompt,
      ROOT
    )
  ).rejects.toThrow(/JSON/u);
  expect(readFileSync(diary.weeks[0].file, "utf-8")).toBe(before);
});

it("reports a missing subprocess without an unhandled error or hanging", async () => {
  const result = await run(
    ["naita-test-nonexistent-executable"],
    ROOT,
    "test input",
    1000
  );
  expect(result.success).toBe(false);
  expect(result.stderr).toMatch(/ENOENT/u);
});
