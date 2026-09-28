import {
  mkdirSync,
  readFileSync,
  writeFileSync,
  existsSync,
  renameSync,
  cpSync,
} from "node:fs";
import path from "node:path";

import { afterEach, expect, it } from "vitest";

import { execute } from "../../src/cli/main.mts";
import { readHistory } from "../../src/diary/history.mts";
import { loadDiary, paths } from "../../src/diary/store.mts";
import {
  fixture,
  PROFILE,
  ROOT,
  git,
  commit,
  screenshot,
  cli,
} from "../helpers/fixtures.mts";

let context;
afterEach(() => context?.cleanup());

it("initializes all weekly screenshot folders and keeps the entire local workspace ignored", async () => {
  context = fixture();
  const workspace = path.join(context.root, "new student");
  await execute("init", {
    from: path.join(ROOT, "docs/examples/profile.json"),
    workspace,
  });
  const location = paths(workspace);
  const diary = loadDiary(workspace);
  expect(diary.weeks).toHaveLength(2);
  for (const week of diary.weeks) {
    expect(existsSync(week.file)).toBe(true);
    expect(existsSync(week.screenshotFolder)).toBe(true);
    expect(week.file.startsWith(location.local)).toBe(true);
  }
  expect(existsSync(location.output)).toBe(true);
  expect(existsSync(location.journal)).toBe(true);
  expect(existsSync(path.join(workspace, "naita-diary.json"))).toBe(false);
  expect(existsSync(path.join(workspace, "diary"))).toBe(false);
  git(workspace, ["init", "-q"]);
  expect(
    git(workspace, ["status", "--porcelain", "--untracked-files=all"])
  ).toBe("");
  const before = readFileSync(diary.weeks[0].file);
  await execute("init", {
    from: path.join(ROOT, "docs/examples/profile.json"),
    workspace,
  });
  expect(readFileSync(diary.weeks[0].file)).toEqual(before);
});

it("reuses multiple cached repositories offline and journals manual insert/edit/remove operations", async () => {
  context = fixture();
  const { workspace, repo } = context;
  const options = { workspace };
  const first = commit(repo, "2026-04-06T10:00:00Z", "Add search");
  const secondRepo = path.join(context.root, "backend");
  git(context.root, ["clone", "-q", repo, secondRepo]);
  const second = commit(secondRepo, "2026-04-07T10:00:00Z", "Add filtering");
  await execute("import", { ...options, leave: "", medical: "", repo });
  // Adding a source works without the previous repository being accessible.
  renameSync(repo, `${repo}-offline`);
  await execute("import", { ...options, repo: secondRepo });
  expect(loadDiary(workspace).state.repos).toEqual([repo, secondRepo]);
  expect(loadDiary(workspace).state.commits.map((item) => item.hash)).toEqual([
    first,
    second,
  ]);
  expect(loadDiary(workspace).state.commits[0].repos).toEqual([
    repo,
    secondRepo,
  ]);
  const beforeFailedImport = readFileSync(paths(workspace).state);
  await expect(
    execute("import", { ...options, author: "Someone else", repo: secondRepo })
  ).rejects.toThrow(/all saved/u);
  expect(readFileSync(paths(workspace).state)).toEqual(beforeFailedImport);
  await execute("draft", options);
  await execute("accept", { ...options, "accept-drafts": true, week: "1" });
  const last = loadDiary(workspace).weeks[0].entry.sections.work.at(-1).id;
  await execute("add", {
    ...options,
    actor: "codex",
    before: last,
    reason: "Student supplied this activity.",
    section: "work",
    text: "Discussed feedback with my supervisor.",
    week: "1",
  });
  const [week] = loadDiary(workspace).weeks;
  const [, manual] = week.entry.sections.work;
  expect(manual.source).toBe("manual");
  expect(manual.evidence).toEqual([]);
  const insertion = readHistory(workspace).find(
    (event) => event.action === "add"
  );
  expect(insertion).toMatchObject({
    actor: "codex",
    reason: "Student supplied this activity.",
    target: { before: last },
  });
  expect(insertion.changes[0].after.value.sections.work[1].text).toBe(
    manual.text
  );
  // A subsequent refresh adds evidence without discarding or reordering notes.
  const third = commit(
    secondRepo,
    "2026-04-08T10:00:00Z",
    "Check empty inputs"
  );
  await execute("import", { ...options, repo: secondRepo });
  expect(loadDiary(workspace).state.commits.map((item) => item.hash)).toEqual([
    first,
    second,
    third,
  ]);
  expect(loadDiary(workspace).weeks[0].entry.sections.work).toEqual(
    week.entry.sections.work
  );
  await execute("edit", {
    ...options,
    id: manual.id,
    section: "work",
    text: "Reviewed supervisor feedback.",
    week: "1",
  });
  await execute("edit", {
    ...options,
    id: manual.id,
    remove: true,
    section: "work",
    week: "1",
  });
  const removed = readHistory(workspace).findLast(
    (event) => event.action === "edit"
  );
  expect(removed.changes[0].before.value.sections.work[1].text).toBe(
    "Reviewed supervisor feedback."
  );
  expect(
    removed.changes[0].after.value.sections.work.some(
      (item) => item.id === manual.id
    )
  ).toBe(false);
  renameSync(secondRepo, `${secondRepo}-offline`);
  const [refreshed] = loadDiary(workspace).weeks;
  refreshed.entry.sections.work[0].text = "Manually clarified the search work.";
  writeFileSync(refreshed.file, JSON.stringify(refreshed.entry));
  screenshot(refreshed.screenshotFolder);
  const journalBeforeDryRun = readFileSync(paths(workspace).journal);
  await execute("generate", { ...options, "dry-run": true });
  expect(readFileSync(paths(workspace).journal)).toEqual(journalBeforeDryRun);
  // history/show/status also checkpoint changes made in an external editor.
  const history = cli(workspace, "history", { week: "1" });
  const external = history.events.find(
    (event) =>
      event.action === "external-edit" &&
      event.changes.some((change) => change.path.startsWith("weeks/"))
  );
  expect(
    external.changes.find((change) => change.path.startsWith("weeks/")).after
      .value.sections.work[0].text
  ).toBe("Manually clarified the search work.");
  cpSync(
    path.join(refreshed.screenshotFolder, "01-task-list.png"),
    path.join(refreshed.screenshotFolder, "02-feedback.png")
  );
  const historyResult = await execute("history", { ...options, week: "1" });
  const imageEvent = historyResult.events.at(-1);
  expect(imageEvent.action).toBe("external-edit");
  expect(imageEvent.changes).toHaveLength(1);
  expect(imageEvent.changes[0]).toMatchObject({
    after: { kind: "file", sha256: expect.any(String) },
    before: null,
    path: "screenshots/week-01-2026-04-06/02-feedback.png",
  });
  await execute("draft", options);
  const result = await execute("generate", options);
  expect(result.path).toBe(
    path.join(paths(workspace).output, "NAITA-Daily-Diary.pdf")
  );
  expect(existsSync(result.path)).toBe(true);
  expect(readHistory(workspace).at(-1)).toMatchObject({
    action: "generate",
    output: { path: result.path },
  });
});

it("copies legacy profiles, cached history, notes, screenshots and PDFs without altering the old files", async () => {
  context = fixture();
  await execute("init", {
    from: path.join(ROOT, "docs/examples/profile.json"),
    workspace: context.workspace,
  });
  await execute("add", {
    section: "work",
    text: "Legacy student note.",
    week: "1",
    workspace: context.workspace,
  });
  const [week] = loadDiary(context.workspace).weeks;
  screenshot(week.screenshotFolder);
  const legacy = path.join(context.root, "legacy student");
  const current = paths(context.workspace);
  mkdirSync(path.join(legacy, "diary"), { recursive: true });
  cpSync(current.profile, path.join(legacy, "naita-diary.json"));
  cpSync(current.state, path.join(legacy, "diary/state.json"));
  cpSync(current.weeks, path.join(legacy, "diary/weeks"), { recursive: true });
  cpSync(current.screenshots, path.join(legacy, "diary/screenshots"), {
    recursive: true,
  });
  mkdirSync(path.join(legacy, "output"));
  writeFileSync(
    path.join(legacy, "output/previous.pdf"),
    "legacy output fixture"
  );
  const source = readFileSync(path.join(legacy, "naita-diary.json"));
  const dryRun = await execute("generate", {
    "dry-run": true,
    workspace: legacy,
  });
  expect(dryRun.config.name).toBe(PROFILE.name);
  expect(existsSync(paths(legacy).local)).toBe(false);
  await execute("status", { workspace: legacy });
  const [migrated] = loadDiary(legacy).weeks;
  expect(migrated.entry.sections.work[0].text).toBe("Legacy student note.");
  expect(
    readFileSync(path.join(migrated.screenshotFolder, "01-task-list.png"))
  ).toEqual(readFileSync(path.join(week.screenshotFolder, "01-task-list.png")));
  expect(
    readFileSync(path.join(paths(legacy).output, "previous.pdf"), "utf-8")
  ).toBe("legacy output fixture");
  expect(readFileSync(path.join(legacy, "naita-diary.json"))).toEqual(source);
  expect(readHistory(legacy)[0].action).toBe("migration");
  await execute("profile", {
    field: "name",
    text: "Updated locally",
    workspace: legacy,
  });
  await execute("status", { workspace: legacy });
  expect(loadDiary(legacy).config.name).toBe("Updated locally");
  expect(readFileSync(path.join(legacy, "naita-diary.json"))).toEqual(source);
});

it("refuses to overwrite diary data when the change log is damaged", async () => {
  context = fixture();
  const options = { workspace: context.workspace };
  await execute("add", {
    ...options,
    section: "work",
    text: "Keep this student note.",
    week: "1",
  });
  const [week] = loadDiary(context.workspace).weeks;
  const location = paths(context.workspace);
  const before = readFileSync(week.file);
  const journal = readFileSync(location.journal, "utf-8");
  for (const damaged of [
    '{"unfinished":',
    '{"schemaVersion":1,"changes":[{}]}\n',
  ]) {
    writeFileSync(location.journal, journal + damaged);
    // Each damaged journal must be observed and rejected before the next one
    // is written, so the loop body cannot be parallelised.
    // oxlint-disable-next-line no-await-in-loop
    await expect(
      execute("add", {
        ...options,
        section: "work",
        text: "Another note.",
        week: "1",
      })
    ).rejects.toThrow(/Cannot read history event/u);
    expect(readFileSync(week.file)).toEqual(before);
    expect(readFileSync(location.journal, "utf-8")).toBe(journal + damaged);
  }
  writeFileSync(location.journal, journal);
  await execute("add", {
    ...options,
    section: "work",
    text: "Another note.",
    week: "1",
  });
  expect(
    loadDiary(context.workspace).weeks[0].entry.sections.work
  ).toHaveLength(2);
});
