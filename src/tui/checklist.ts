import path from "node:path";

import type { ChecklistPlan, CommandRunner } from "./client";
import type { DiaryShell } from "./shell";

export const showChecklist = async (
  ui: DiaryShell,
  run: CommandRunner,
  back: () => Promise<void>,
  number?: number
) => {
  const plan = await run<ChecklistPlan>(
    "checklist",
    number ? { week: String(number) } : {}
  );
  const again = () => showChecklist(ui, run, back, number);
  const week = number ? plan.weeks[0] : undefined;
  const tasks = week ? week.tasks : plan.tasks;
  ui.show(
    week
      ? `Week ${number} | Screenshot checklist`
      : "Checklist | screenshots last",
    week
      ? `Week folder: ${path.basename(week.folder)}\n${week.folder}\nWrite first; add screenshots last. Choose a capture idea below.`
      : `Finish writing, add screenshots last, then review/export.\nSaved guide: ${plan.path}`,
    [
      ...tasks.map((task) => ({
        action: () =>
          ui.show(
            task.label,
            `${task.detail}\nCLI: bun run cli -- ${task.command}`,
            [{ action: again, name: "Back to checklist" }],
            again
          ),
        description: task.detail,
        name: `[${task.done ? "x" : " "}] ${task.label}`,
      })),
      ...(week
        ? week.ideas.map((idea) => ({
            action: () =>
              ui.show(
                "What to capture (optional)",
                `${idea.capture}\nSave in: ${week.folder}`,
                [
                  {
                    action: () =>
                      ui.show(
                        "Capture source",
                        `${idea.activity}\n${idea.evidence.join(", ")}\n${idea.repos.join("; ")}`,
                        [{ action: again, name: "Back to checklist" }],
                        again
                      ),
                    description:
                      "PNG/JPEG filenames are optional; review the actual image content.",
                    name: `Suggested filename: ${idea.filename}`,
                  },
                  { action: again, name: "Back to checklist" },
                ],
                again
              ),
            description:
              idea.source === "git"
                ? `Git evidence: ${idea.dates.join(", ")}`
                : "Student-supplied work note",
            name: `Capture idea: ${idea.activity}`,
          }))
        : plan.weeks.map((item) => ({
            action: () => showChecklist(ui, run, again, item.number),
            description: item.folder,
            name: `Week ${item.number} | ${item.monday} | ${item.ideas.length} capture ideas`,
          }))),
      { action: again, name: "Refresh checklist" },
      { action: back, name: "Back" },
    ],
    back
  );
};
