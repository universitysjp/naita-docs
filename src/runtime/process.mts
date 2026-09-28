import {
  spawn as nodeSpawn,
  spawnSync as nodeSpawnSync,
} from "node:child_process";

export interface ProcessResult {
  success: boolean;
  stdout: string;
  stderr: string;
}

export const runSync = (command: string[], cwd: string): ProcessResult => {
  if (typeof Bun !== "undefined") {
    const result = Bun.spawnSync({
      cmd: command,
      cwd,
      stderr: "pipe",
      stdout: "pipe",
    });
    return {
      stderr: result.stderr.toString(),
      stdout: result.stdout.toString(),
      success: result.success,
    };
  }
  const result = nodeSpawnSync(command[0], command.slice(1), {
    cwd,
    encoding: "utf-8",
  });
  return {
    stderr: String(result.stderr ?? ""),
    stdout: String(result.stdout ?? ""),
    success: result.status === 0,
  };
};

export const run = async (
  command: string[],
  cwd: string,
  input = "",
  timeoutMs = 180_000,
  options: { windowsVerbatimArguments?: boolean } = {}
): Promise<ProcessResult> => {
  if (typeof Bun !== "undefined") {
    const child = Bun.spawn({
      cmd: command,
      cwd,
      stderr: "pipe",
      stdin: "pipe",
      stdout: "pipe",
      windowsHide: true,
      ...options,
    });
    const timer = setTimeout(() => child.kill(), timeoutMs);
    if (input) {
      child.stdin.write(input);
    }
    child.stdin.end();
    const [stdout, stderr, code] = await Promise.all([
      new Response(child.stdout).text(),
      new Response(child.stderr).text(),
      child.exited,
    ]);
    clearTimeout(timer);
    return { stderr, stdout, success: code === 0 };
  }
  // The node:child_process fallback is a callback API with no promise
  // equivalent; it only runs under Vitest's Node workers, never under Bun.
  // oxlint-disable-next-line promise/avoid-new -- node callback API
  return await new Promise((resolve) => {
    const child = nodeSpawn(command[0], command.slice(1), {
      cwd,
      windowsHide: true,
      ...options,
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => (stdout += chunk));
    child.stderr?.on("data", (chunk) => (stderr += chunk));
    const timer = setTimeout(() => child.kill(), timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ stderr: error.message, stdout, success: false });
    });
    child.stdin?.on("error", (error) => {
      stderr += error.message;
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stderr, stdout, success: code === 0 });
    });
    child.stdin?.end(input);
  });
};
