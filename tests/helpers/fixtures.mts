import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";

import { saveProfile } from "../../src/diary/store.mts";

export const ROOT = path.resolve(import.meta.dirname, "../..");
export const PROFILE = {
  category: "Undergraduate",
  establishment: "Example Software Team",
  field: "Information and Communication Technology",
  instituteRegistration: "ICT/TEST/001",
  naitaRegistration: "TEST/001",
  name: "Sample Trainee",
  phone: "011 123 4567",
  privateAddress: "12 Sample Road, Colombo",
  trainingEnd: "2026-04-17",
  trainingLocation: "Colombo office",
  trainingStart: "2026-04-06",
};
export const PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4z8DwHwAFgAI/ScLttAAAAABJRU5ErkJggg==",
  "base64"
);
// A generated 2x2 JPEG, small enough to exercise Node's pooled file buffers.
export const JPEG = Buffer.from(
  "/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAMCAgICAgMCAgIDAwMDBAYEBAQEBAgGBgUGCQgKCgkICQkKDA8MCgsOCwkJDRENDg8QEBEQCgwSExIQEw8QEBD/2wBDAQMDAwQDBAgEBAgQCwkLEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBAQEBD/wAARCAACAAIDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAn/xAAUEAEAAAAAAAAAAAAAAAAAAAAA/8QAFAEBAAAAAAAAAAAAAAAAAAAAAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAMAwEAAhEDEQA/AJVAA//Z",
  "base64"
);
export const git = (repo, args, env = {}) =>
  execFileSync("git", ["-C", repo, ...args], {
    encoding: "utf-8",
    env: { ...process.env, ...env },
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();
export const commit = (
  repo,
  date,
  subject,
  {
    body = "",
    committerDate = date,
    authorName = "Sample Trainee",
    authorEmail = "trainee@example.test",
  } = {}
) => {
  git(
    repo,
    [
      "-c",
      "commit.gpgsign=false",
      "commit",
      "--quiet",
      "--allow-empty",
      "-m",
      subject,
      ...(body ? ["-m", body] : []),
    ],
    {
      GIT_AUTHOR_DATE: date,
      GIT_AUTHOR_EMAIL: authorEmail,
      GIT_AUTHOR_NAME: authorName,
      GIT_COMMITTER_DATE: committerDate,
    }
  );
  return git(repo, ["rev-parse", "HEAD"]);
};
export const fixture = (profile = PROFILE) => {
  const root = mkdtempSync(path.join(tmpdir(), "naita-test-"));
  const workspace = path.join(root, "diary workspace");
  const repo = path.join(root, "external repository");
  mkdirSync(workspace);
  mkdirSync(repo);
  saveProfile(workspace, structuredClone(profile));
  git(repo, ["init", "-q"]);
  git(repo, ["config", "user.name", "Sample Trainee"]);
  git(repo, ["config", "user.email", "trainee@example.test"]);
  return {
    cleanup: () => rmSync(root, { force: true, recursive: true }),
    repo,
    root,
    workspace,
  };
};
export const seedRepo = (repo) => {
  commit(
    repo,
    "2026-04-06T10:00:00+05:30",
    "feat(search): add a search box to the task list",
    {
      body: "Users can find tasks by title.",
    }
  );
  commit(
    repo,
    "2026-04-07T15:00:00+05:30",
    "fix: handle an empty search result"
  );
  commit(
    repo,
    "2026-04-13T11:00:00+05:30",
    "test: add checks for task filtering"
  );
};
export const cli = (workspace, command, options = {}) => {
  const args = [
    path.join(ROOT, "src/cli.mts"),
    command,
    "--workspace",
    workspace,
    "--json",
  ];
  for (const [key, value] of Object.entries(options)) {
    if (value === false || value === undefined) {
      continue;
    }
    for (const part of Array.isArray(value) ? value : [value]) {
      args.push(`--${key}`);
      if (part !== true) {
        args.push(String(part));
      }
    }
  }
  return JSON.parse(
    execFileSync("bun", ["run", ...args], {
      encoding: "utf-8",
      stdio: ["ignore", "pipe", "pipe"],
    })
  );
};
export const screenshot = (folder, name = "01-task-list.png") => {
  writeFileSync(path.join(folder, name), PNG);
};
