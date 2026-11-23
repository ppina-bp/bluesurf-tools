import { execFile } from "node:child_process";
import { access, mkdir, readFile, realpath, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { readTomlFile, writeTomlFile } from "./config/toml.js";
import { packageRoot, projectConfigPath } from "./paths.js";
import { resolveInitAnswers, resolveUserPath } from "./wizard-answers.js";

const execFileAsync = promisify(execFile);

const CURSOR_RULE = `---
description: Bluesurf project verify commands
alwaysApply: false
---

Run the commands in **AGENTS.md** (Verify section) before marking implement done.
Use \`bluesurf\` for Surf ticket workflows; workstore paths follow \`.surf/project.toml\`.
`;

const GITIGNORE_LINE = ".bluesurf/";

export async function initRepo({
  cwd = process.cwd(),
  argv = [],
  stdinIsTTY = false,
  ask,
  projectCode = "RLD",
  gitToplevel,
  home,
} = {}) {
  const cwdReal = await existingRealpath(cwd);
  let top = gitToplevel;
  if (top === undefined) top = await detectGitToplevel(cwdReal);
  const topReal = top ? await existingRealpath(top) : null;

  const homeDir = home ?? os.homedir();
  const flaggedRoot = explicitRoot(argv, cwdReal, homeDir);
  const docDir = flaggedRoot ?? topReal ?? cwdReal;
  let projectDoc = null;
  try {
    projectDoc = await readTomlFile(projectConfigPath(docDir));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }

  const answers = await collectInitAnswers({
    argv,
    stdinIsTTY,
    cwd: cwdReal,
    home: homeDir,
    gitToplevel: topReal,
    projectCode,
    projectDoc,
    ask,
  });

  const repoRoot = answers.repoRoot;
  await mkdir(repoRoot, { recursive: true });
  const agentsPath = path.join(repoRoot, "AGENTS.md");
  if (!await exists(agentsPath)) {
    const template = await readFile(path.join(packageRoot(), "templates", "AGENTS.md.template"), "utf8");
    const filled = template
      .replaceAll("npm run ticket-done", "bluesurf ticket-done")
      .replaceAll(
        "Obsidian vault (`Proyect/Tickets/{code}/validation/`)",
        "project workstore (`Tickets/{code}/validation/` — see `.surf/project.toml`)",
      );
    await writeFile(agentsPath, filled);
  }

  const projectDocOut = { ...(projectDoc ?? {}), version: 1, project_code: answers.projectCode };
  if (answers.workstoreKind === "repo") {
    projectDocOut.workstore = { kind: "repo", root: ".bluesurf", vcs: { tracked: answers.tracked } };
    await mkdir(path.join(repoRoot, ".bluesurf"), { recursive: true });
    await applyWorkstoreGitignore(repoRoot, answers.tracked);
  } else {
    delete projectDocOut.workstore;
  }

  await mkdir(path.join(repoRoot, ".surf"), { recursive: true });
  const writtenProjectPath = projectConfigPath(repoRoot);
  await writeTomlFile(writtenProjectPath, projectDocOut);

  const rulesDir = path.join(repoRoot, ".cursor", "rules");
  await mkdir(rulesDir, { recursive: true });
  const rulePath = path.join(rulesDir, "bluesurf-project.mdc");
  if (!await exists(rulePath)) await writeFile(rulePath, CURSOR_RULE);

  return { repoRoot, projectCode: answers.projectCode, agentsPath, projectPath: writtenProjectPath };
}

function explicitRoot(argv, cwd, home) {
  const index = argv.indexOf("--cwd");
  if (index === -1 || !argv[index + 1]) return null;
  return resolveUserPath(argv[index + 1], cwd, home);
}

async function collectInitAnswers(input) {
  const prompted = {};
  for (;;) {
    const resolved = resolveInitAnswers({ ...input, prompted });
    if (!resolved.ok) throw new Error(resolved.error);
    if (resolved.prompt.length === 0) return resolved.answers;
    if (!input.ask) throw new Error(`Missing answer for ${resolved.prompt[0]}. Re-run with a flag or a terminal.`);
    const value = await input.ask(resolved.prompt[0], resolved.answers);
    if (value == null) {
      const error = new Error("Init cancelled.");
      error.cancelled = true;
      throw error;
    }
    prompted[resolved.prompt[0]] = value;
  }
}

async function applyWorkstoreGitignore(repoRoot, tracked) {
  const gitignorePath = path.join(repoRoot, ".gitignore");
  let gitignore = "";
  try {
    gitignore = await readFile(gitignorePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const lines = gitignore.split(/\r?\n/);
  const kept = lines.filter((line) => line.trim() !== GITIGNORE_LINE && line.trim() !== ".bluesurf");
  if (!tracked && !kept.some((line) => line.trim() === GITIGNORE_LINE)) {
    if (kept.length > 0 && kept[kept.length - 1] === "") kept.pop();
    if (kept.length > 0) kept.push(GITIGNORE_LINE);
    else kept.push(GITIGNORE_LINE);
  }
  if (!tracked || gitignore) {
    const text = `${kept.join("\n").replace(/\n+$/, "")}\n`;
    if (!tracked || text.trim()) await writeFile(gitignorePath, text);
    else if (gitignore && !text.trim()) await rm(gitignorePath, { force: true });
  }
}

async function detectGitToplevel(cwd) {
  try {
    const { stdout } = await execFileAsync("git", ["rev-parse", "--show-toplevel"], { cwd });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

async function existingRealpath(directory) {
  try {
    return await realpath(directory);
  } catch (error) {
    if (error.code === "ENOENT") return path.resolve(directory);
    throw error;
  }
}

async function exists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}
