import { SECTIONS } from "../diary/entries.mts";
import { showChecklist } from "./checklist";
import type {
  CommandRunner,
  DiaryStatus,
  ScreenshotScan,
  WeekDetail,
  WeekIndex,
} from "./client";
import type { Choice, DiaryShell } from "./shell";

export class WeekScreens {
  private ui: DiaryShell;
  private run: CommandRunner;
  private home: () => Promise<void>;

  constructor(ui: DiaryShell, run: CommandRunner, home: () => Promise<void>) {
    this.ui = ui;
    this.run = run;
    this.home = home;
  }

  async list() {
    const result = await this.run<WeekIndex>("weeks");
    const status = await this.run<DiaryStatus>("status");
    this.ui.show(
      "Choose a week",
      `${status.completedWeeks}/${status.weeks.length} weeks ready. Open any week to continue.`,
      result.weeks.map((week) => {
        const progress = status.weeks.find(
          (item) => item.number === week.number
        );
        return {
          action: () => this.week(week.number),
          description: `${progress.screenshots.images.length} screenshots, ${progress.suggestions} suggestions, review ${progress.reviewed ? "current" : "needed"}`,
          name: `Week ${week.number} | ${week.monday} | ${progress.percent}% filled`,
        };
      }),
      this.home
    );
  }
  async week(number: number) {
    const status = await this.run<DiaryStatus>("status", {
      week: String(number),
    });
    const [progress] = status.weeks;
    const missing = [...progress.missing, ...progress.missingDays];
    this.ui.show(
      `Week ${number} | ${progress.monday} to ${progress.sunday}`,
      `${progress.percent}% filled | ${progress.screenshots.images.length} screenshots | ${progress.suggestions} suggestions\n${missing.length ? `Still needed: ${missing.join(", ")}` : "Content filled. Review it when you are ready."}${progress.conflicts.length ? `\nAttendance conflicts: ${progress.conflicts.join(", ")}` : ""}`,
      [
        ...Object.entries(SECTIONS).map(([section, label]) => ({
          action: () => this.section(number, section),
          name: `${label} (${progress.sections[section]} points)`,
        })),
        {
          action: () => this.days(number),
          description: "Add or edit a dated point",
          name: "Daily work",
        },
        {
          action: () => this.suggestions(number),
          description: "Draft, accept, answer, or dismiss",
          name: "Suggestions",
        },
        {
          action: () => this.screenshots(number),
          description: "View the folder, add captions, or mark not needed",
          name: "Screenshots",
        },
        {
          action: async () => {
            await this.run("review", { week: String(number) });
            await this.week(number);
          },
          name: "Mark this week reviewed",
        },
      ],
      () => this.list()
    );
  }
  async section(number: number, section: string, date?: string) {
    const week = await this.run<WeekDetail>("show", { week: String(number) });
    const points = date ? week.entry.days[date] : week.entry.sections[section];
    const target: Record<string, string> = date ? { date } : { section };
    // SAFETY: when `date` is unset the only callers are the SECTIONS menu, which
    // passes a key of SECTIONS, so the index below always exists.
    const label = date || SECTIONS[section as keyof typeof SECTIONS];
    const back = () => (date ? this.days(number) : this.week(number));
    const list = () => this.section(number, section, date);
    const write = (id?: string, before?: string, text = "") =>
      this.ui.form(
        `${id ? "Edit" : "Add"} a point`,
        [{ key: "text", label, value: text }],
        async (values) => {
          const options = {
            week: String(number),
            ...target,
            text: values.text,
          };
          if (id) {
            options.id = id;
          }
          if (before) {
            options.before = before;
          }
          await this.run(id ? "edit" : "add", options);
          await list();
        },
        list
      );
    const choices: Choice[] = [
      {
        action: () => write(),
        description: "Write what you did in your own words",
        name: "Add a point",
      },
    ];
    for (const point of points) {
      choices.push({
        action: () =>
          this.ui.show(
            label,
            point.text,
            [
              {
                action: () => write(point.id, undefined, point.text),
                name: "Edit this point",
              },
              {
                action: () => write(undefined, point.id),
                name: "Insert a point before this",
              },
              {
                action: async () => {
                  await this.run("edit", {
                    id: point.id,
                    ...target,
                    remove: true,
                    week: String(number),
                  });
                  await list();
                },
                name: "Remove this point",
              },
            ],
            list
          ),
        description: "Edit, insert before, or remove this point",
        name: point.text,
      });
    }
    this.ui.show(
      `Week ${number} | ${label}`,
      `Each entry is a bullet point. ${date ? "Git descriptions fill the daily table until you customize it." : "Write about the whole week."}\nManual file: ${week.file}`,
      choices,
      back
    );
  }
  async days(number: number) {
    const week = await this.run<WeekDetail>("show", { week: String(number) });
    this.ui.show(
      `Week ${number} | Daily work`,
      "Attendance is set from the home menu.",
      week.days
        .filter((day) => day.status === "work")
        .map((day) => ({
          action: () => this.section(number, "work", day.date),
          description: `${day.commits.length} commits; ${week.entry.days[day.date].length} saved points`,
          name: day.date,
        })),
      () => this.week(number)
    );
  }
  async suggestions(number: number) {
    const week = await this.run<WeekDetail>("show", { week: String(number) });
    const back = () => this.suggestions(number);
    const choices: Choice[] = [
      {
        action: async () => {
          await this.run("draft", { week: String(number) });
          await back();
        },
        name: "Prepare suggestions from Git history",
      },
      {
        action: async () => {
          await this.run("draft", { agent: "codex", week: String(number) });
          await back();
        },
        description:
          "Codex returns reviewable proposals; accepted points stay separate",
        name: "Ask Codex to draft suggestions",
      },
      {
        action: async () => {
          await this.run("draft", { agent: "claude", week: String(number) });
          await back();
        },
        description:
          "Claude Code returns reviewable proposals; accepted points stay separate",
        name: "Ask Claude Code to draft suggestions",
      },
    ];
    for (const suggestion of week.entry.suggestions) {
      choices.push({
        action: () => {
          const actions: Choice[] = [
            {
              action: () =>
                this.ui.form(
                  "Your diary point",
                  [
                    {
                      key: "text",
                      label: suggestion.text,
                      value:
                        suggestion.kind === "question" ? "" : suggestion.text,
                    },
                  ],
                  async ({ text }) => {
                    await this.run("accept", {
                      id: suggestion.id,
                      text,
                      week: String(number),
                    });
                    await back();
                  },
                  back
                ),
              name:
                suggestion.kind === "question"
                  ? "Answer and add to the diary"
                  : "Edit wording and accept",
            },
          ];
          if (suggestion.kind === "draft") {
            actions.push({
              action: async () => {
                await this.run("accept", {
                  id: suggestion.id,
                  week: String(number),
                });
                await back();
              },
              name: "Accept this wording",
            });
          }
          actions.push({
            action: async () => {
              await this.run("dismiss", {
                id: suggestion.id,
                week: String(number),
              });
              await back();
            },
            name: "Dismiss",
          });
          this.ui.show(
            "Review suggestion",
            `${suggestion.text}\n${suggestion.reason}`,
            actions,
            back
          );
        },
        description:
          suggestion.kind === "question"
            ? "Your answer is needed"
            : "Suggested wording for review",
        name: `${suggestion.section}: ${suggestion.text}`,
      });
    }
    this.ui.show(
      `Week ${number} | Suggestions`,
      "Only accepted points appear in your diary. Answer questions from your own experience.",
      choices,
      () => this.week(number)
    );
  }
  async screenshots(number: number) {
    const result = await this.run<ScreenshotScan>("screenshots", {
      week: String(number),
    });
    const back = () => this.screenshots(number);
    const choices: Choice[] = [
      {
        action: () => showChecklist(this.ui, this.run, back, number),
        name: "What screenshots should I add? (checklist)",
      },
      { action: back, name: "Refresh folder" },
      {
        action: () =>
          this.ui.form(
            "Screenshots not needed",
            [
              {
                key: "reason",
                label: "Reason (clear it to require screenshots again)",
                optional: true,
                value: result.notRequiredReason,
              },
            ],
            async ({ reason }) => {
              await this.run("screenshots", {
                reason,
                week: String(number),
              });
              await back();
            },
            back
          ),
        name: "Set or clear a reason for no screenshots",
      },
    ];
    for (const image of result.images) {
      choices.push({
        action: () =>
          this.ui.form(
            "Screenshot caption",
            [
              {
                key: "text",
                label: "Briefly explain what the image shows",
                value: image.caption,
              },
            ],
            async ({ text }) => {
              await this.run("screenshots", {
                file: image.name,
                text,
                week: String(number),
              });
              await back();
            },
            back
          ),
        description: image.caption,
        name: image.name,
      });
    }
    this.ui.show(
      `Week ${number} | Screenshots`,
      `Put PNG or JPEG files here, then refresh:\n${result.folder}\n${result.errors.join("; ")}${result.ignored.length ? `\nUnsupported: ${result.ignored.join(", ")}` : ""}`,
      choices,
      () => this.week(number)
    );
  }
}
