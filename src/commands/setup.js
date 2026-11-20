import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { setup as runSetup, harnessesFromArgs } from "../setup.js";
import {
  ensureGlobalConfigDir,
  promptWorkstoreConfig,
  syncLegacyEnvFromConfig,
  writeGlobalConfig,
} from "../setup-config.js";
import { deepMerge } from "../config/merge.js";
import { defaultConfig } from "../config/defaults.js";
import { spawn } from "node:child_process";
import { packageRoot } from "../paths.js";
import { spawnSpec } from "../spawn-command.js";

function run(command, args, { cwd }) {
  const spec = spawnSpec(command, args);
  return new Promise((resolve) => {
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };
    const child = spawn(spec.command, spec.args, { cwd, stdio: "inherit", ...spec.options });
    child.on("error", (error) => finish({ code: 1, stderr: error.message }));
    child.on("close", (code) => finish({ code: code ?? 1 }));
  });
}

export async function setupCommand(argv) {
  const harnesses =
    argv.length > 0 ? harnessesFromArgs(argv) : undefined;
  const home = os.homedir();
  const repoRoot = packageRoot();
  const stdinIsTTY = input.isTTY;
  const prompt = stdinIsTTY
    ? (question) => createInterface({ input, output }).question(`${question}\n> `)
    : undefined;

  await ensureGlobalConfigDir(home);
  const workstorePartial = await promptWorkstoreConfig({
    prompt: prompt ?? (async () => {
      throw new Error("No harness selected. Use flags or run in a TTY.");
    }),
    stdinIsTTY,
    env: process.env,
  });
  const partial = deepMerge(defaultConfig(), workstorePartial);
  if (harnesses) partial.harnesses = { enabled: harnesses };
  const config = await writeGlobalConfig(home, partial);

  await writeFile(path.join(repoRoot, ".env"), syncLegacyEnvFromConfig(config));

  const result = await runSetup({
    args: harnesses ? harnesses.flatMap((h) => [`--${h}`]) : argv,
    repoRoot,
    home,
    env: process.env,
    stdinIsTTY,
    prompt,
    run,
    skillsRepoRoot: config.skills?.source?.trim() || repoRoot,
  });

  for (const warning of result.warnings) console.warn(warning);
  if (result.loggedIn) console.log("Signed in during setup.");
  console.log(`Wrote ${path.join(home, ".config", "bluesurf", "config.toml")}`);
  return 0;
}