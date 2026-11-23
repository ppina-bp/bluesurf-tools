import { stdin as input } from "node:process";
import { readTomlFile } from "../config/toml.js";
import { globalConfigPath, userHome } from "../paths.js";
import { initRepo } from "../init-repo.js";
import { createInitAsk, wizardIntro, wizardOutro } from "../wizard-prompts.js";

async function inheritedProjectCode() {
  try {
    const config = await readTomlFile(globalConfigPath(userHome()));
    const code = config?.surf?.project_code;
    if (typeof code === "string" && code.trim()) return code.trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  return "RLD";
}

export async function initCommand(argv) {
  wizardIntro("bluesurf init");
  let result;
  try {
    result = await initRepo({
      cwd: process.cwd(),
      argv,
      stdinIsTTY: Boolean(input.isTTY),
      ask: input.isTTY ? createInitAsk() : undefined,
      projectCode: await inheritedProjectCode(),
      home: userHome(),
    });
  } catch (error) {
    if (error.cancelled) return 1;
    throw error;
  }

  wizardOutro(`Initialized ${result.repoRoot}\n  ${result.agentsPath}\n  ${result.projectPath}`);
  return 0;
}
