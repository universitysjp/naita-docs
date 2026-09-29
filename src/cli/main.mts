import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { agentContext, agentPrompt } from "../ai/prompt.mts";
import {
  createChecklist,
  formatChecklist,
  saveChecklist,
} from "../diary/checklist.mts";
import { checkpoint, readHistory } from "../diary/history.mts";
import { paths, hasLegacyData, initializeLocal } from "../diary/paths.mts";
import { diaryStatus, formatStatus } from "../diary/status.mts";
import {
  applyAllocation,
  ensureWeeks,
  loadDiary,
  loadProfile,
  loadState,
  selectWeek,
} from "../diary/store.mts";
import { prepareDiary, draftWeeks } from "../diary/workflow.mts";
import { buildTemplateReport } from "../report/template.mts";
import { parseArgs } from "./args.mts";
import { companyCommand, formatCompany } from "./company.mts";
import { generate } from "./export.mts";
import { HELP } from "./help.mts";
import { profileCommand } from "./profile.mts";
import { formatReport, reportCommand } from "./report.mts";
import { formatStamp, stampCommand } from "./stamp.mts";
import { weeklyCommand } from "./weekly.mts";

/** Repository root, used for the paths of tracked artefacts such as the template. */
const ROOT = path.resolve(import.meta.dirname, "..", "..");

/* oxlint-disable func-style, no-use-before-define, complexity --
   execute and dispatch stay hoisted function declarations because they are
   mutually referenced across the module; converting them to const arrow
   expressions would risk a temporal dead zone at call time. The command set
   itself is what makes the branch count high. */
export async function execute(command, options = {}) {
  const workspace = path.resolve(options.workspace || process.cwd());
  if (["help", "agent-guide"].includes(command) || options["dry-run"]) {
    return dispatch(command, workspace, options);
  }
  let migrated = false;
  if (!existsSync(paths(workspace).local) && hasLegacyData(workspace)) {
    migrated = initializeLocal(workspace);
  }
  checkpoint(workspace, migrated ? "migration" : "external-edit", {
    observedBy: command,
  });
  const details = {
    actor: options.actor || "cli",
    target: Object.fromEntries(
      ["week", "date", "section", "id", "before"]
        .filter((key) => options[key] !== undefined)
        .map((key) => [key, options[key]])
    ),
  };
  if (options.reason) {
    details.reason = options.reason;
  }
  try {
    const result = await dispatch(command, workspace, options);
    const recordsOutput = ["generate", "report", "report-template"].includes(
      command
    );
    const success = { ...details, outcome: "success" };
    if (recordsOutput) {
      success.output = {
        complete: result.complete,
        pages: result.pages,
        path: result.path,
      };
    }
    checkpoint(workspace, command, success, recordsOutput);
    if (command === "checklist" || existsSync(paths(workspace).profile)) {
      try {
        const checklist =
          command === "checklist" ? result : await createChecklist(workspace);
        saveChecklist(checklist);
        if (command === "import") {
          result.checklist = checklist;
        }
      } catch (error) {
        if (command === "checklist") {
          throw error;
        }
        // A derived report must not hide successful edits or prevent inspecting
        // a damaged week via history. Report that the saved checklist is stale.
        const warning = `Checklist was not refreshed: ${error.message}. Run checklist after fixing the problem.`;
        // result is the command's parsed JSON payload, already validated by
        // dispatch; the warning is attached only when there is an object to
        // attach it to.
        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- boundary value from JSON.parse
        if (typeof result === "object") {
          result.checklistWarning = warning;
        } else {
          console.error(warning);
        }
      }
    }
    if (command === "checklist" && options.week) {
      return { ...result, weeks: [selectWeek(result, options.week)] };
    }
    return result;
  } catch (error) {
    checkpoint(workspace, command, { ...details, outcome: "failed" });
    throw error;
  }
}

/* oxlint-enable func-style, no-use-before-define, complexity */
/* oxlint-disable func-style, complexity --
   dispatch stays hoisted and is called by execute above; the branch count is
   the flat command table. */
async function dispatch(command, workspace, options) {
  if (command === "help") {
    return HELP;
  }
  if (command === "agent-guide") {
    return readFileSync(
      new URL("../../docs/AI-WORKFLOW.md", import.meta.url),
      "utf-8"
    );
  }
  if (command === "checklist") {
    initializeLocal(workspace);
    const checklist = await createChecklist(workspace);
    if (options.week) {
      selectWeek(checklist, options.week);
    }
    return checklist;
  }
  if (command === "history") {
    const events = readHistory(workspace);
    if (!options.week) {
      return { events, path: paths(workspace).journal };
    }
    const week = selectWeek(loadDiary(workspace), options.week);
    const key = `weeks/${path.basename(week.file)}`;
    const images = `screenshots/${path.basename(week.screenshotFolder)}/`;
    return {
      events: events.filter((event) =>
        event.changes.some(
          (change) => change.path === key || change.path.startsWith(images)
        )
      ),
      path: paths(workspace).journal,
    };
  }
  if (command === "init" || command === "profile") {
    return profileCommand(workspace, options, command === "init");
  }
  if (command === "allocation") {
    return applyAllocation(workspace);
  }
  if (command === "weeks") {
    return {
      message: "Week files and screenshot folders are ready.",
      weeks: ensureWeeks(workspace).weeks.map(
        ({ number, monday, sunday, file, screenshotFolder }) => ({
          file,
          monday,
          number,
          screenshotFolder,
          sunday,
        })
      ),
    };
  }
  if (command === "status") {
    const config = loadProfile(workspace);
    const diary =
      config.trainingStart && config.trainingEnd
        ? loadDiary(workspace)
        : { config, state: loadState(workspace), weeks: [] };
    if (options.week) {
      diary.weeks = [selectWeek(diary, options.week)];
    }
    return diaryStatus(diary);
  }
  if (command === "import" || command === "absence") {
    if (
      command === "absence" &&
      !["leave", "medical", "off"].some((key) => options[key] !== undefined)
    ) {
      throw new Error('Supply --leave, --medical, or --off (use "" for none).');
    }
    const diary = prepareDiary(workspace, {
      ...options,
      sync: command === "import",
    });
    return {
      message:
        command === "import"
          ? `Imported ${diary.state.commits.length} commits from ${diary.state.repos.length} repositories. Existing points are preserved.`
          : "Saved absence dates.",
      state: diary.state,
    };
  }
  if (command === "show" || command === "context") {
    const diary = loadDiary(workspace);
    const weeks = options.week
      ? [selectWeek(diary, options.week)]
      : diary.weeks;
    if (command === "show") {
      return selectWeek(diary, options.week);
    }
    return options.prompt
      ? agentPrompt(weeks)
      : {
          instructions:
            "Use agent-guide for the CLI workflow. Add proposals with draft --from FILE; accepted points remain untouched.",
          weeks: agentContext(weeks),
        };
  }
  if (command === "draft") {
    const diary = await draftWeeks(workspace, options);
    return {
      message: "Suggestions saved for review. Use show, accept, or dismiss.",
      weeks: diary.weeks
        .filter(
          (week) =>
            !options.week ||
            week.number === selectWeek(diary, options.week).number
        )
        .map((week) => ({
          number: week.number,
          suggestions: week.entry.suggestions,
        })),
    };
  }
  if (
    [
      "add",
      "edit",
      "accept",
      "dismiss",
      "review",
      "rewrite",
      "screenshots",
    ].includes(command)
  ) {
    return weeklyCommand(command, workspace, options);
  }
  if (command === "generate") {
    return generate(workspace, options);
  }
  if (command === "report") {
    return reportCommand(workspace, options);
  }
  if (command === "company") {
    return companyCommand(workspace, options);
  }
  if (command === "stamp") {
    return stampCommand(workspace, options);
  }
  if (command === "report-template") {
    return buildTemplateReport(
      path.resolve(
        options.out || path.join(ROOT, "docs", "final-report-template.pdf")
      ),
      { cacheFolder: options.cache, font: options.font, logo: options.logo }
    );
  }
  throw new Error(`Unknown command: ${command}`);
}
/* oxlint-enable func-style, complexity */
// oxlint-disable-next-line func-style -- hoisted entrypoint
export async function main(argv = process.argv.slice(2)) {
  const { command, options } = parseArgs(argv);
  const result = await execute(command, options);
  if (options.json || (command === "generate" && options["dry-run"])) {
    console.log(JSON.stringify(result, null, 2));
  } else if (command === "status") {
    console.log(formatStatus(result));
  } else if (command === "report") {
    console.log(formatReport(result));
  } else if (command === "company") {
    console.log(formatCompany(result));
  } else if (command === "stamp") {
    console.log(formatStamp(result));
  } else if (command === "checklist") {
    console.log(formatChecklist(result, { markdown: false }));
  } else if (command === "import" && result.checklist) {
    console.log(
      `${result.message}\n\n${formatChecklist(result.checklist, { markdown: false })}`
    );
    // help and agent-guide return raw text; every other command returns JSON.
    // oxlint-disable-next-line anti-slop/no-runtime-typeof -- boundary value from JSON.parse
  } else if (typeof result === "string") {
    console.log(result);
  } else if (result.message) {
    console.log(result.message);
  } else {
    console.log(JSON.stringify(result, null, 2));
  }
  if (result.checklistWarning && !options.json) {
    console.error(result.checklistWarning);
  }
  return result;
}
