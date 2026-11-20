import os from "node:os";
import { readFile } from "node:fs/promises";
import { packageRoot, globalConfigPath, pathExists } from "./paths.js";
import { loadMergedConfig } from "./config/load.js";
import { linkBlueSurfSkills, HARNESS_ORDER } from "./setup.js";
import { readTomlFile } from "./config/toml.js";

export async function runUpgrade({ home = os.homedir(), withMatt = false } = {}) {
  const notes = [];
  const pkg = JSON.parse(await readFile(`${packageRoot()}/package.json`, "utf8"));
  notes.push(`Package version: ${pkg.version ?? "0.0.0"}`);

  let harnesses = [...HARNESS_ORDER];
  if (await pathExists(globalConfigPath(home))) {
    const global = await readTomlFile(globalConfigPath(home));
    if (global.harnesses?.enabled?.length) harnesses = global.harnesses.enabled;
  }

  const { config } = await loadMergedConfig({ home });
  const skillsRoot = config.skills?.source?.trim() || packageRoot();
  await linkBlueSurfSkills({ repoRoot: skillsRoot, home, harnesses });
  notes.push(`Refreshed skill symlinks from ${skillsRoot}`);
  if (withMatt) notes.push("Re-run bluesurf setup with Matt Pocock enabled to refresh Matt skills.");

  return { notes };
}