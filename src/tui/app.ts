import type { CliRenderer } from "@opentui/core";

import { PROFILE_FIELDS } from "../diary/profile.mts";
import { showChecklist } from "./checklist";
import type {
  CommandRunner,
  DiaryStatus,
  GeneratedFile,
  ReportResult,
} from "./client";
import { DiaryShell } from "./shell";
import { WeekScreens } from "./weeks";

type ProfileConfig = Record<string, string>;
interface GenerateOptions {
  out?: string;
  strict: boolean;
}

export const createDiaryApp = (renderer: CliRenderer, run: CommandRunner) => {
  const ui = new DiaryShell(renderer);
  const home = async () => {
    const status = await run<DiaryStatus>("status");
    ui.show(
      "NAITA internship diary",
      `Profile ${status.profile.filled}/${status.profile.total} | ${status.completedWeeks}/${status.weeks.length} weeks ready\nAbsences ${status.absencesConfirmed ? "confirmed" : "not confirmed"} | ${status.commits} commits imported\nChoose any step. Your saved work is kept when you come back.`,
      [
        {
          // The screens below are mutually recursive const arrows, so this menu
          // always lists them before their own declarations.
          // oxlint-disable-next-line no-use-before-define -- mutually recursive screens
          action: profile,
          description: "Fill or change one field at a time",
          name: "Student and training profile",
        },
        {
          // oxlint-disable-next-line no-use-before-define -- mutually recursive screens
          action: () => weeks.list(),
          description: "Write points, review suggestions, and add screenshots",
          name: "Weekly diary",
        },
        {
          // oxlint-disable-next-line no-use-before-define -- mutually recursive screens
          action: importRepo,
          description: "Read a project here or elsewhere on your computer",
          name: "Import Git history",
        },
        {
          // oxlint-disable-next-line no-use-before-define -- mutually recursive screens
          action: attendance,
          description:
            "Confirm leave and medical dates, even when there are none",
          name: "Leave and non-working dates",
        },
        {
          // oxlint-disable-next-line no-use-before-define -- mutually recursive screens
          action: () => showChecklist(ui, run, home),
          description:
            "Write first; see what to capture and which week folder to use",
          name: "Checklist and screenshot plan",
        },
        {
          // oxlint-disable-next-line no-use-before-define -- mutually recursive screens
          action: exportMenu,
          description:
            "Create a draft or a completed diary using the supplied template",
          name: "Export PDF",
        },
        {
          // oxlint-disable-next-line no-use-before-define -- mutually recursive screens
          action: reportMenu,
          description:
            "Create a report from the diary, evidence, logo, and screenshots",
          name: "Generate industrial training report",
        },
        { action: home, name: "Refresh status" },
        { action: () => renderer.destroy(), name: "Exit" },
      ],
      () => Promise.resolve()
    );
  };
  const weeks = new WeekScreens(ui, run, home);
  const profile = async () => {
    const config = await run<ProfileConfig>("profile");
    ui.show(
      "Student and training profile",
      "Select any field to edit it. Set training dates before opening weekly entries.",
      Object.entries(PROFILE_FIELDS).map(([key, label]) => ({
        action: () =>
          ui.form(
            label,
            [
              {
                key: "text",
                label,
                optional: true,
                value: config[key],
              },
            ],
            async ({ text }) => {
              await run("profile", { field: key, text });
              await profile();
            },
            profile
          ),
        description: config[key] || "Not filled in yet",
        name: label,
      })),
      home
    );
  };
  const importRepo = () => {
    ui.form(
      "Import Git history",
      [
        { key: "repo", label: "Path to the Git repository" },
        {
          key: "author",
          label:
            "Your Git author name or email (recommended in shared repositories)",
          optional: true,
        },
      ],
      async (values) => {
        await run("import", values);
        await showChecklist(ui, run, home);
      },
      home
    );
  };
  const attendance = async () => {
    const { absence } = await run<DiaryStatus>("status");
    ui.form(
      "Attendance",
      [
        {
          key: "leave",
          label:
            "Authorized leave dates: YYYY-MM-DD or START..END; comma separated",
          optional: true,
          value: (absence.leave || []).join(", "),
        },
        {
          key: "medical",
          label: "Medical leave dates (blank for none)",
          optional: true,
          value: (absence.medical || []).join(", "),
        },
        {
          key: "off",
          label: "Additional holidays/non-working dates (blank for none)",
          optional: true,
          value: (absence.off || []).join(", "),
        },
      ],
      async (values) => {
        await run("absence", values);
        await home();
      },
      home
    );
  };
  const exportMenu = () => {
    const exportPdf = (strict: boolean) =>
      ui.form(
        "Export PDF",
        [
          {
            key: "out",
            label:
              "Output PDF path (blank for local/output/NAITA-Daily-Diary.pdf)",
            optional: true,
          },
        ],
        async ({ out }) => {
          const options: GenerateOptions = { strict };
          if (out) {
            options.out = out;
          }
          const result = await run<GeneratedFile>("generate", options);
          ui.show(
            "PDF created",
            result.message,
            [{ action: home, name: "Back to diary" }],
            home
          );
        },
        exportMenu
      );
    ui.show(
      "Export PDF",
      "Confirm absence dates first. A completed export also needs all weekly content and reviews.",
      [
        { action: () => exportPdf(false), name: "Export a draft" },
        { action: () => exportPdf(true), name: "Export completed diary" },
      ],
      home
    );
  };
  const reportMenu = () => {
    const createReport = async () => {
      const result = await run<ReportResult>("report");
      const blankProfile = result.missing?.profile?.join(", ") || "none";
      ui.show(
        "Report created",
        `${result.message}\nProfile fields still blank: ${blankProfile}\nEditable source: ${result.sourcePath}`,
        [{ action: home, name: "Back to home" }],
        home
      );
    };
    ui.show(
      "Generate industrial training report",
      "The report is generated from the diary workspace. Missing academic and company facts stay as placeholders.",
      [
        { action: createReport, name: "Create report draft" },
        { action: home, name: "Back" },
      ],
      home
    );
  };
  return { home, start: () => ui.perform(home), ui };
};
