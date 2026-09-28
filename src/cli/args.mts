import { parseArgs as parseNodeArgs } from "node:util";

const shared = ["workspace", "json", "actor", "reason"];
const commandOptions = {
  absence: ["leave", "medical", "off"],
  accept: ["week", "id", "text", "before", "accept-drafts"],
  add: ["week", "section", "date", "text", "before"],
  "agent-guide": [],
  checklist: ["week"],
  context: ["week", "prompt"],
  dismiss: ["week", "id"],
  draft: ["week", "from", "agent", "agent-command"],
  edit: ["week", "section", "date", "text", "id", "remove"],
  generate: [
    "repo",
    "author",
    "leave",
    "medical",
    "off",
    "out",
    "font",
    "template",
    "strict",
    "dry-run",
    "agent",
    "agent-command",
  ],
  help: [],
  history: ["week"],
  import: ["repo", "author", "leave", "medical", "off"],
  init: ["from"],
  profile: ["from", "field", "text"],
  report: ["out", "font", "logo"],
  review: ["week"],
  screenshots: ["week", "file", "text", "reason"],
  show: ["week"],
  status: ["week"],
  weeks: [],
};
export const parseArgs = (argv) => {
  const args = argv[0] === "--" ? argv.slice(1) : argv;
  let [command = "help", ...rest] = args;
  rest = [...rest];
  if (["-h", "--help"].includes(command) || rest.includes("--help")) {
    return { command: "help", options: {} };
  }
  if (command === "export") {
    command = "generate";
  }
  if (!Object.hasOwn(commandOptions, command)) {
    throw new Error(
      `Unknown command: ${command}. Run help for the command list.`
    );
  }
  const boolean = new Set([
    "json",
    "strict",
    "dry-run",
    "remove",
    "accept-drafts",
    "prompt",
  ]);
  const definitions = Object.fromEntries(
    [...shared, ...commandOptions[command]].map((key) => {
      const definition = { type: boolean.has(key) ? "boolean" : "string" };
      if (key === "repo") {
        return [key, { multiple: true, ...definition }];
      }
      return [key, definition];
    })
  );
  const { values } = parseNodeArgs({
    allowPositionals: false,
    args: rest,
    options: definitions,
    strict: true,
  });
  return { command, options: values };
};
