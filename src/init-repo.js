import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { defaultConfig } from "./config/defaults.js";
import { loadMergedConfig } from "./config/load.js";
import { writeTomlFile } from "./config/toml.js";
import { packageRoot, projectConfigPath } from "./paths.js";

const CURSOR_RULE = `---
description: Bluesurf project verify commands
alwaysApply: false
---

Run the commands in **AGENTS.md** (Verify section) before marking implement done.
Use \`bluesurf\` for Surf ticket workflows; workstore paths follow \`.surf/project.toml\`.
`;

export async function initRepo({ cwd = process.cwd(), prompt, stdinIsTTY = false } = {}) {
  const repoRoot = path.resolve(cwd);
  const templatePath = path.join(packageRoot(), "templates", "AGENTS.md.template");
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  let agentsExists = true;
  try {
    await access(agentsPath);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    agentsExists = false;
  }
  if (!agentsExists) {
    const template = await readFile(templatePath, "utf8");
    const filled = template
      .replaceAll("npm run ticket-done", "bluesurf ticket-done")
      .replaceAll(
        "Obsidian vault (`Proyect/Tickets/{code}/validation/`)",
        "project workstore (`Tickets/{code}/validation/` — see `.surf/project.toml`)",
      );
    await writeFile(agentsPath, filled);
  }

  const { config } = await loadMergedConfig({ cwd: repoRoot });
  let projectCode = config.surf?.project_code ?? defaultConfig().surf.project_code;
  let workstoreKind = "inherit";
  if (stdinIsTTY && prompt) {
    projectCode =
      (await prompt(`Project code [${projectCode}]:`)).trim() || projectCode;
    const ws = (
      await prompt("Workstore: (1) use global default (2) store in this repo [.bluesurf]:")
    ).trim();
    if (ws === "2") workstoreKind = "repo";
  }

  const projectDoc = { version: 1, project_code: projectCode };
  if (workstoreKind === "repo") {
    projectDoc.workstore = { kind: "repo", root: ".bluesurf", vcs: { tracked: false } };
    const gitignorePath = path.join(repoRoot, ".gitignore");
    let gitignore = "";
    try {
      gitignore = await readFile(gitignorePath, "utf8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (!gitignore.includes(".bluesurf/")) {
      await writeFile(gitignorePath, `${gitignore}${gitignore.endsWith("\n") || gitignore === "" ? "" : "\n"}.bluesurf/\n`);
    }
  }

  await mkdir(path.join(repoRoot, ".surf"), { recursive: true });
  await writeTomlFile(projectConfigPath(repoRoot), projectDoc);

  const rulesDir = path.join(repoRoot, ".cursor", "rules");
  await mkdir(rulesDir, { recursive: true });
  const rulePath = path.join(rulesDir, "bluesurf-project.mdc");
  try {
    await access(rulePath);
  } catch (error) {
    if (error.code === "ENOENT") await writeFile(rulePath, CURSOR_RULE);
    else throw error;
  }

  return { repoRoot, projectCode, agentsPath, projectPath: projectConfigPath(repoRoot) };
}