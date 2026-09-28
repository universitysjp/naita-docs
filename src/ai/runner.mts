import { run } from "../runtime/process.mts";

export const runAgent = async (options, prompt, workspace) => {
  if (options.agent && !["codex", "claude"].includes(options.agent)) {
    throw new Error("--agent must be codex or claude.");
  }
  if (options.agent && options["agent-command"]) {
    throw new Error("Choose --agent or --agent-command, not both.");
  }
  const custom = options["agent-command"];
  const executable = custom || options.agent;
  if (!executable) {
    throw new Error(
      "Choose an agent or import its suggestions with --from FILE."
    );
  }
  let args: string[];
  if (custom) {
    args =
      process.platform === "win32"
        ? [process.env.ComSpec || "cmd.exe", "/d", "/s", "/c", `"${custom}"`]
        : ["sh", "-c", custom];
  } else if (options.agent === "codex") {
    args = ["exec", "--skip-git-repo-check", "--sandbox", "read-only", "-"];
  } else {
    args = ["-p"];
  }
  const result = await run(
    custom ? args : [executable, ...args],
    workspace,
    prompt,
    180_000,
    {
      windowsVerbatimArguments: Boolean(custom && process.platform === "win32"),
    }
  );
  if (!result.success) {
    throw new Error(
      `Writing agent failed: ${result.stderr.slice(-10_000) || "process failed"}`
    );
  }
  if (result.stdout.length > 5 * 1024 * 1024) {
    throw new Error("Agent response exceeded 5 MB.");
  }
  try {
    const text = result.stdout
      .trim()
      .replace(/^```(?:json)?\s*/u, "")
      .replace(/\s*```$/u, "");
    return JSON.parse(text);
  } catch {
    throw new Error(
      "Writing agent must return a JSON object without extra commentary."
    );
  }
};
