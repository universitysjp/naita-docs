import { fileURLToPath } from "node:url";

export interface ScreenshotImage {
  caption: string;
  name: string;
}
export interface ScreenshotScan {
  errors: string[];
  folder: string;
  ignored: string[];
  images: ScreenshotImage[];
  notRequiredReason: string;
}
export interface WeekProgress {
  conflicts: string[];
  missing: string[];
  missingDays: string[];
  monday: string;
  number: number;
  percent: number;
  reviewed: boolean;
  screenshots: ScreenshotScan;
  sections: Record<string, number>;
  suggestions: number;
  sunday: string;
}
export interface DiaryStatus {
  absence: {
    leave: string[] | null;
    medical: string[] | null;
    off: string[] | null;
  };
  absencesConfirmed: boolean;
  commits: number;
  completedWeeks: number;
  profile: {
    filled: number;
    missing: string[];
    total: number;
  };
  weeks: WeekProgress[];
}
export interface WeekPoint {
  id: string;
  text: string;
}
export interface WeekSuggestion {
  id: string;
  kind: string;
  reason: string;
  section: string;
  text: string;
}
export interface WeekDay {
  commits: unknown[];
  date: string;
  status: string;
}
export interface WeekDetail {
  days: WeekDay[];
  entry: {
    days: Record<string, WeekPoint[]>;
    sections: Record<string, WeekPoint[]>;
    suggestions: WeekSuggestion[];
  };
  file: string;
  monday: string;
  number: number;
}
export interface WeekIndex {
  weeks: { monday: string; number: number }[];
}
export interface ChecklistTask {
  command: string;
  detail: string;
  done: boolean;
  id: string;
  label: string;
}
export interface CaptureIdea {
  activity: string;
  capture: string;
  dates: string[];
  evidence: string[];
  filename: string;
  id: string;
  repos: string[];
  source: string;
}
export interface ChecklistWeek {
  folder: string;
  ideas: CaptureIdea[];
  monday: string;
  number: number;
  tasks: ChecklistTask[];
}
export interface ChecklistPlan {
  path: string;
  tasks: ChecklistTask[];
  weeks: ChecklistWeek[];
}
export interface GeneratedFile {
  message: string;
  path: string;
}
export interface ReportResult {
  message: string;
  missing?: { profile: string[] };
  sourcePath: string;
}

export type CommandRunner = <T = void>(
  command: string,
  options?: Record<string, string | boolean>
) => Promise<T>;

export const cliClient = (workspace: string): CommandRunner => {
  const run = async <T>(command: string, options = {}) => {
    const args = [
      fileURLToPath(new URL("../cli.mts", import.meta.url)),
      command,
      "--workspace",
      workspace,
      "--json",
    ];
    for (const [key, value] of Object.entries(options)) {
      if (value === false) {
        continue;
      }
      args.push(`--${key}`);
      if (value === true) {
        continue;
      }
      args.push(String(value));
    }
    const child = Bun.spawn(["bun", "run", ...args], {
      stderr: "pipe",
      stdout: "pipe",
    });
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    if (code !== 0) {
      throw new Error(stderr.trim() || `Command exited with ${code}`);
    }
    try {
      const parsed: T = JSON.parse(stdout);
      return parsed;
    } catch {
      throw new Error("The CLI returned an unreadable response.");
    }
  };
  return run;
};
