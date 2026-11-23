import { access, lstat, mkdir, readdir, readFile, rm, stat, symlink, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { defaultConfig } from "./config/defaults.js";
import { deepMerge } from "./config/merge.js";
import { readTomlFile, writeTomlFile } from "./config/toml.js";
import { globalConfigPath } from "./paths.js";
import { skillsCliPackage } from "./skills-cli.js";
import { resolveSetupAnswers } from "./wizard-answers.js";

const ORDER = ["cursor", "codex", "claude"];

const FLAGS = {
  "--cursor": "cursor",
  "--codex": "codex",
  "--claude": "claude",
};

const PLACEHOLDER_VAULT = "/path/to/your/BluePeople/vault";

const RULE_FILES = [
  "no-push-until-i-say-so.md",
  "ask-questions-via-the-harness.md",
  "matt-pocock-skill-router.md",
];

const MANAGED_START = "<!-- bluesurf-tools:start -->";
const MANAGED_END = "<!-- bluesurf-tools:end -->";

const SKILL_AGENTS = {
  cursor: "cursor",
  codex: "codex",
  claude: "claude-code",
};

const SKILL_DIRS = {
  cursor: [".cursor", "skills"],
  codex: [".codex", "skills"],
  claude: [".claude", "skills"],
};

export async function setup({
  args = [],
  repoRoot,
  skillsRepoRoot,
  home,
  env = {},
  stdinIsTTY = false,
  ask,
  run,
  nodeVersion = process.version,
  cwd = process.cwd(),
  onStep,
} = {}) {
  const existing = await readExistingConfig(home);
  const answers = await collectSetupAnswers({
    argv: args,
    env,
    existing,
    stdinIsTTY,
    cwd,
    home,
    ask,
  });
  await ensureWorkstoreDirectory(answers.directory);
  const config = deepMerge(existing ?? defaultConfig(), {
    surf: { project_code: answers.projectCode },
    workstore: {
      kind: answers.workstoreKind,
      root: answers.workstoreKind === "path" ? answers.workstoreRoot : "",
      layout: {
        tickets: answers.ticketsDir,
        sprints: answers.sprintsDir,
      },
    },
    harnesses: { enabled: answers.harnesses },
    ticket: {
      after_pull: answers.afterPull,
      done: { delete_folder: answers.deleteFolder },
    },
    pull: { download_attachments: answers.downloadAttachments },
  });
  await writeTomlFile(globalConfigPath(home), config);

  const warnings = await ensureEnv({
    repoRoot,
    env: { ...env, OBSIDIAN_VAULT: answers.directory },
    stdinIsTTY: false,
  });
  await runStep(run, "npm", ["install"], repoRoot, onStep, "Installing dependencies");
  const skillsCli = skillsCliPackage(nodeVersion);
  if (skillsCli !== "skills@latest") {
    warnings.push(
      `Node ${nodeVersion} is below 22.20.0; Matt Pocock skills install uses ${skillsCli}. Upgrade Node to use skills@latest.`,
    );
  }
  const harnesses = answers.harnesses;
  await runStep(run, "npx", mattPocockArgs(harnesses, skillsCli), repoRoot, onStep, "Installing Matt Pocock skills");
  const skillsRoot = skillsRepoRoot ?? repoRoot;
  const skills = await linkBlueSurfSkills({ repoRoot: skillsRoot, home, harnesses });
  await installRules({ repoRoot, home, harnesses, warnings });
  await removeHarnessInstall({ repoRoot: skillsRoot, home, harnesses: answers.removedHarnesses });
  const loggedIn = await loginIfNeeded({ repoRoot, run, home });
  return { harnesses, warnings, loggedIn, skills };
}

function mattPocockArgs(harnesses, skillsCli) {
  return [
    "--yes",
    skillsCli,
    "add",
    "mattpocock/skills",
    "-g",
    "-y",
    "--skill",
    "*",
    ...harnesses.flatMap((harness) => ["-a", SKILL_AGENTS[harness]]),
  ];
}

async function runStep(run, command, args, cwd, onStep, label) {
  const exec = () => run(command, args, { cwd, stdio: onStep ? "pipe" : "inherit" });
  const result = onStep && label ? await onStep(label, exec) : await exec();
  if (!result || result.code !== 0) {
    const detail = result?.stderr ? `: ${result.stderr}` : "";
    throw new Error(`${command} ${args.join(" ")} exited with code ${result?.code ?? "unknown"}${detail}`);
  }
}

async function loginIfNeeded({ repoRoot, run, home }) {
  const { sessionPaths } = await import("./runtime-context.js");
  const paths = await sessionPaths(home ?? os.homedir());
  try {
    await access(paths.cookieJarPath);
    return false;
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await runStep(run, "node", ["bin/bluesurf.mjs", "login"], repoRoot);
  return true;
}

async function collectSetupAnswers({ argv, env, existing, stdinIsTTY, cwd, home, ask }) {
  const prompted = {};
  for (;;) {
    const resolved = resolveSetupAnswers({
      argv,
      env,
      existing,
      stdinIsTTY,
      cwd,
      home,
      prompted,
    });
    if (!resolved.ok) throw new Error(resolved.error);
    if (resolved.prompt.length === 0) return resolved.answers;
    if (!ask) throw new Error(`Missing answer for ${resolved.prompt[0]}. Re-run with a flag or a terminal.`);
    const value = await ask(resolved.prompt[0], resolved.answers);
    if (value == null) {
      const error = new Error("Setup cancelled.");
      error.cancelled = true;
      throw error;
    }
    prompted[resolved.prompt[0]] = value;
  }
}

async function readExistingConfig(home) {
  try {
    return await readTomlFile(globalConfigPath(home));
  } catch (error) {
    if (error.code === "ENOENT") return null;
    throw error;
  }
}

async function ensureWorkstoreDirectory(directory) {
  if (!directory) throw new Error("Workstore path is required.");
  try {
    const info = await stat(directory);
    if (!info.isDirectory()) throw new Error(`Workstore path is not a directory: ${directory}`);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    await mkdir(directory, { recursive: true });
  }
}

async function removeHarnessInstall({ repoRoot, home, harnesses }) {
  if (!harnesses?.length) return;
  const skills = await listBlueSurfSkills(repoRoot);
  for (const harness of harnesses) {
    for (const name of skills) {
      await unlinkIfSymlink(path.join(home, ...SKILL_DIRS[harness], name));
    }
  }
  if (harnesses.includes("cursor")) {
    for (const fileName of RULE_FILES) {
      await rm(path.join(home, ".cursor", "rules", fileName.replace(/\.md$/, ".mdc")), { force: true });
    }
  }
  if (harnesses.includes("codex")) await stripManagedFile(path.join(home, ".codex", "AGENTS.md"));
  if (harnesses.includes("claude")) await stripManagedFile(path.join(home, ".claude", "CLAUDE.md"));
}

async function unlinkIfSymlink(dest) {
  try {
    const stat = await lstat(dest);
    if (stat.isSymbolicLink()) await unlink(dest);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function stripManagedFile(filePath) {
  let existing;
  try {
    existing = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code === "ENOENT") return;
    throw error;
  }
  const start = existing.indexOf(MANAGED_START);
  const end = existing.indexOf(MANAGED_END);
  if (start === -1 || end < start) return;
  const next = `${existing.slice(0, start)}${existing.slice(end + MANAGED_END.length)}`.replace(/^\n+/, "");
  if (!next.trim()) await rm(filePath, { force: true });
  else await writeFile(filePath, next.endsWith("\n") ? next : `${next}\n`);
}

async function ensureEnv({ repoRoot, env, stdinIsTTY, prompt }) {
  const warnings = [];
  const envPath = path.join(repoRoot, ".env");
  let existing = null;
  try {
    existing = await readFile(envPath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (existing !== null) {
    if (existing.split("\n").some((line) => line.trim() === `OBSIDIAN_VAULT=${PLACEHOLDER_VAULT}`)) {
      warnings.push(`OBSIDIAN_VAULT is still ${PLACEHOLDER_VAULT}. Edit .env before pulling tickets.`);
    }
    return warnings;
  }

  let vault = env.OBSIDIAN_VAULT;
  if (!vault) {
    if (!stdinIsTTY) {
      throw new Error("Set OBSIDIAN_VAULT, or run setup in a terminal so it can ask for the vault path.");
    }
    vault = (await prompt("OBSIDIAN_VAULT (path to your Obsidian vault):")).trim();
    if (!vault) throw new Error("OBSIDIAN_VAULT is required.");
  }
  if (!await isDirectory(vault)) {
    warnings.push(`OBSIDIAN_VAULT does not exist yet: ${vault}`);
  }

  const example = await readFile(path.join(repoRoot, ".env.example"), "utf8");
  if (!example.split("\n").some((line) => line.startsWith("OBSIDIAN_VAULT="))) {
    throw new Error(".env.example is missing OBSIDIAN_VAULT.");
  }
  const lines = example.split("\n").map((line) => (
    line.startsWith("OBSIDIAN_VAULT=") ? `OBSIDIAN_VAULT=${vault}` : line
  ));
  await writeFile(envPath, lines.join("\n"));
  return warnings;
}

const REPO_SKILL_NAMES = new Set(["functional-test"]);

export async function listBlueSurfSkills(repoRoot) {
  const entries = await readdir(path.join(repoRoot, "skills"), { withFileTypes: true });
  return entries
    .filter(
      (entry) =>
        entry.isDirectory()
        && (entry.name.startsWith("bluesurf-") || REPO_SKILL_NAMES.has(entry.name)),
    )
    .map((entry) => entry.name)
    .sort();
}

/** Symlink every bluesurf-* skill from this repo into ~/.agents/skills and selected harnesses. */
export async function linkBlueSurfSkills({ repoRoot, home, harnesses }) {
  const skills = await listBlueSurfSkills(repoRoot);
  const placements = [];
  for (const name of skills) {
    const target = path.join(repoRoot, "skills", name);
    const dests = [
      path.join(home, ".agents", "skills", name),
      ...harnesses.map((harness) => path.join(home, ...SKILL_DIRS[harness], name)),
    ];
    for (const dest of dests) placements.push({ dest, target });
  }
  for (const { dest } of placements) await assertSkillLinkable(dest);
  for (const { dest, target } of placements) await linkSkill(dest, target);
  return skills;
}

export function harnessesFromArgs(args) {
  const picked = [];
  for (const arg of args) {
    if (arg === "--all") continue;
    const name = FLAGS[arg];
    if (!name) {
      throw new Error(`Unknown argument ${arg}. Use --cursor, --codex, --claude, or --all.`);
    }
    picked.push(name);
  }
  if (args.includes("--all")) return [...ORDER];
  if (picked.length === 0) {
    throw new Error("Choose a harness with --cursor, --codex, --claude, or --all.");
  }
  return ORDER.filter((name) => picked.includes(name));
}

export { ORDER as HARNESS_ORDER, SKILL_DIRS };

async function installRules({ repoRoot, home, harnesses, warnings }) {
  const rules = [];
  for (const fileName of RULE_FILES) {
    const markdown = await readFile(path.join(repoRoot, "rules", fileName), "utf8");
    rules.push({ ...parseRule(markdown, fileName), fileName });
  }
  const section = renderManaged(rules);
  if (harnesses.includes("cursor")) {
    const dir = path.join(home, ".cursor", "rules");
    await mkdir(dir, { recursive: true });
    for (const rule of rules) {
      const base = rule.fileName.replace(/\.md$/, ".mdc");
      await writeFile(path.join(dir, base), renderCursorRule(rule));
    }
    const titles = rules.map((rule) => rule.title).join("; ");
    warnings.push(`Cursor Settings still has these user rules. Delete them so they are not applied twice: ${titles}`);
  }
  const legacy = await readFile(path.join(repoRoot, "rules", "AGENTS.md"), "utf8");
  if (harnesses.includes("codex")) {
    await installManagedFile(path.join(home, ".codex", "AGENTS.md"), section, legacy, rules, warnings);
  }
  if (harnesses.includes("claude")) {
    await installManagedFile(path.join(home, ".claude", "CLAUDE.md"), section, legacy, rules, warnings);
    warnings.push("Skip the Claude Code plugin mattpocock-skills so those skills are not installed twice.");
  }
}

function parseRule(markdown, fileName) {
  const match = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) throw new Error(`${fileName} is missing frontmatter.`);
  const title = match[1].match(/^title:\s*(.*)\s*$/m)?.[1]?.trim();
  if (!title) throw new Error(`${fileName} is missing a title.`);
  return { title, body: match[2].trim() };
}

function renderCursorRule(rule) {
  return `---\ndescription: ${rule.title}\nalwaysApply: true\n---\n\n${rule.body}\n`;
}

function renderManaged(rules) {
  const body = rules.map((rule) => `## ${rule.title}\n\n${rule.body}`).join("\n\n");
  return `${MANAGED_START}\n${body}\n${MANAGED_END}\n`;
}

async function installManagedFile(filePath, section, legacy, rules, warnings) {
  await mkdir(path.dirname(filePath), { recursive: true });
  let existing = null;
  try {
    existing = await readFile(filePath, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  const { text, duplicateHeadings } = applyManagedSection(existing, section, legacy, rules);
  await writeFile(filePath, text);
  if (duplicateHeadings.length > 0) {
    warnings.push(`These rules are also outside the managed section. Remove the old copy: ${duplicateHeadings.join("; ")}`);
  }
}

function applyManagedSection(existing, section, legacy, rules) {
  if (existing === null || existing.trim() === legacy.trim()) {
    return { text: section, duplicateHeadings: [] };
  }
  const start = existing.indexOf(MANAGED_START);
  const end = existing.indexOf(MANAGED_END);
  let text;
  if (start !== -1 && end > start) {
    text = `${existing.slice(0, start)}${section.trimEnd()}${existing.slice(end + MANAGED_END.length)}`;
  } else {
    text = `${section}${existing.startsWith("\n") ? existing.slice(1) : existing}`;
  }
  if (!text.endsWith("\n")) text += "\n";
  const outsideStart = text.indexOf(MANAGED_START);
  const outsideEnd = text.indexOf(MANAGED_END);
  const outside = text.slice(0, outsideStart) + text.slice(outsideEnd + MANAGED_END.length);
  const duplicateHeadings = rules
    .map((rule) => rule.title)
    .filter((title) => outside.split("\n").includes(`## ${title}`));
  return { text, duplicateHeadings };
}

async function isDirectory(vault) {
  try {
    const stat = await lstat(vault);
    return stat.isDirectory();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function assertSkillLinkable(dest) {
  try {
    const stat = await lstat(dest);
    if (!stat.isSymbolicLink()) {
      throw new Error(`${dest} already exists and is not a symlink. Setup leaves it in place.`);
    }
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
}

async function linkSkill(dest, target) {
  await mkdir(path.dirname(dest), { recursive: true });
  try {
    const stat = await lstat(dest);
    if (!stat.isSymbolicLink()) {
      throw new Error(`${dest} already exists and is not a symlink. Setup leaves it in place.`);
    }
    await unlink(dest);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  await symlink(target, dest);
}
