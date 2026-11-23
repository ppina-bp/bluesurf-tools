import { spawn } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { stdin as input } from "node:process";
import { packageRoot } from "../paths.js";
import { setup as runSetup } from "../setup.js";
import { spawnSpec } from "../spawn-command.js";
import { createSetupAsk, createStepRunner, wizardIntro, wizardOutro, wizardWarn } from "../wizard-prompts.js";

function run(command, args, { cwd, stdio = "inherit" }) {
  const spec = spawnSpec(command, args);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    let output = "";
    const child = spawn(spec.command, spec.args, {
      cwd,
      ...spec.options,
      stdio: stdio === "pipe" ? ["ignore", "pipe", "pipe"] : "inherit",
    });
    if (stdio === "pipe") {
      child.stdout?.on("data", (chunk) => {
        output += chunk;
      });
      child.stderr?.on("data", (chunk) => {
        output += chunk;
      });
    }
    child.on("error", (error) => finish({ code: 1, stderr: error.message }));
    child.on("close", (code) => finish({ code: code ?? 1, stderr: output }));
  });
}

export async function setupCommand(argv) {
  const home = os.homedir();
  wizardIntro("bluesurf setup");
  let result;
  try {
    result = await runSetup({
      args: argv,
      repoRoot: packageRoot(),
      home,
      env: process.env,
      stdinIsTTY: input.isTTY,
      ask: input.isTTY ? createSetupAsk() : undefined,
      run,
      onStep: input.isTTY ? createStepRunner() : undefined,
      cwd: process.cwd(),
    });
  } catch (error) {
    if (error.cancelled) return 1;
    throw error;
  }

  for (const warning of result.warnings) wizardWarn(warning);
  if (result.loggedIn) wizardWarn("Signed in during setup.");
  wizardOutro(`Wrote ${path.join(home, ".config", "bluesurf", "config.toml")}`);
  return 0;
}
