import path from "node:path";

import { readJson } from "../diary/store.mts";
import {
  describeCompany,
  loadCompany,
  researchCompany,
  saveCompany,
} from "../report/company.mts";

export { formatCompany } from "../report/company.mts";

const withMessage = (stored) => {
  const described = describeCompany(stored);
  const found = described.fields.length;
  return {
    ...described,
    message: found
      ? `Company record for ${described.name} has ${found} field(s) with public sources.`
      : "No company research saved yet. Give the establishment's name and run company --name 'NAME' --agent codex to fill it in from public sources.",
    warnings: (stored.rejected || []).map(
      (reason) => `Dropped an unverified finding: ${reason}.`
    ),
  };
};

/**
 * Researches the training establishment and stores the result under
 * `local/report/company/company.json`. Without an agent or a file, the saved
 * record is reported so a student can see what is already known.
 */
export const companyCommand = async (workspace, options = {}) => {
  const name = options.name || options.establishment || "";
  if (options.from) {
    if (options.agent || options["agent-command"]) {
      throw new Error("Choose --from or a research agent, not both.");
    }
    const file = path.resolve(options.from);
    const response = readJson(file, null);
    if (!response) {
      throw new Error(
        `Could not read company research from ${file}. The file must contain {"findings":[...]}.`
      );
    }
    return withMessage(
      saveCompany(workspace, name || response.name, response.findings)
    );
  }
  if (options.agent || options["agent-command"]) {
    return withMessage(await researchCompany(workspace, name, options));
  }
  if (name) {
    throw new Error(
      "Choose how to research the company: --agent codex, --agent claude, --agent-command COMMAND, or --from FILE."
    );
  }
  return withMessage(loadCompany(workspace));
};
