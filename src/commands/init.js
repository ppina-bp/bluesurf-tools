import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { parseCommonArgs } from "../argv.js";
import { initRepo } from "../init-repo.js";

export async function initCommand(argv) {
  const { options } = parseCommonArgs(argv);
  const stdinIsTTY = input.isTTY;
  const prompt = stdinIsTTY
    ? (question) => createInterface({ input, output }).question(`${question}\n> `)
    : undefined;
  const result = await initRepo({ cwd: options.cwd, prompt, stdinIsTTY });
  console.log(`Initialized ${result.repoRoot}`);
  console.log(`  ${result.agentsPath}`);
  console.log(`  ${result.projectPath}`);
  return 0;
}