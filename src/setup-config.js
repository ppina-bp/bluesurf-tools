import { defaultConfig } from "./config/defaults.js";
import { deepMerge } from "./config/merge.js";
import { writeTomlFile } from "./config/toml.js";
import { configDir, globalConfigPath, localWorkstoreRoot } from "./paths.js";

export async function writeGlobalConfig(home, partial) {
  const data = deepMerge(defaultConfig(), partial);
  await writeTomlFile(globalConfigPath(home), data);
  return data;
}

export function syncLegacyEnvFromConfig(config) {
  const lines = [];
  if (config.surf?.origin) lines.push(`BLUESURF_ORIGIN=${config.surf.origin}`);
  if (config.surf?.project_code) lines.push(`BLUESURF_PROJECT=${config.surf.project_code}`);
  const kind = config.workstore?.kind ?? "path";
  if (kind === "path" && config.workstore?.root) {
    lines.push(`OBSIDIAN_VAULT=${config.workstore.root}`);
  } else if (kind === "local" && config.surf?.project_code) {
    lines.push(`OBSIDIAN_VAULT=${localWorkstoreRoot(config.surf.project_code)}`);
  }
  const tickets = config.workstore?.layout?.tickets;
  const sprints = config.workstore?.layout?.sprints;
  if (tickets) lines.push(`OBSIDIAN_TICKETS_DIR=${tickets}`);
  if (sprints) lines.push(`OBSIDIAN_SPRINTS_DIR=${sprints}`);
  return `${lines.join("\n")}\n`;
}

const WORKSTORE_MENU = `Workstore — where should ticket/sprint notes live by default?
1) Folder I choose (Obsidian or any path on disk)
2) Under ~/.local/share/bluesurf/workstore/<project_code>/

Enter 1 or 2:`;

export async function promptWorkstoreConfig({ prompt, stdinIsTTY, env = {} }) {
  const base = defaultConfig();
  if (!stdinIsTTY) {
    if (env.BLUESURF_WORKSTORE_KIND === "local") {
      base.workstore.kind = "local";
      return base;
    }
    const root = env.OBSIDIAN_VAULT || env.BLUESURF_WORKSTORE_ROOT;
    if (!root) throw new Error("Set OBSIDIAN_VAULT or BLUESURF_WORKSTORE_ROOT for non-interactive setup.");
    base.workstore.kind = "path";
    base.workstore.root = root;
    return base;
  }

  const choice = (await prompt(WORKSTORE_MENU)).trim();
  if (choice === "2") {
    base.workstore.kind = "local";
    const code =
      (await prompt(`Project code [${base.surf.project_code}]:`)).trim() || base.surf.project_code;
    base.surf.project_code = code;
    return base;
  }
  const root = (await prompt("Workstore folder path:")).trim();
  if (!root) throw new Error("Workstore path is required.");
  base.workstore.kind = "path";
  base.workstore.root = root;
  return base;
}

export async function ensureGlobalConfigDir(home) {
  await import("node:fs/promises").then((fs) => fs.mkdir(configDir(home), { recursive: true }));
}