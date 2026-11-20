import { defaultConfig } from "./defaults.js";
import { deepMerge } from "./merge.js";
import { readTomlFile } from "./toml.js";
import {
  findProjectRoot,
  globalConfigPath,
  packageRoot,
  pathExists,
  projectConfigPath,
  userHome,
} from "../paths.js";
import path from "node:path";
import { loadEnvFile } from "../env.js";

function overlayFromEnv(base) {
  const overlay = {};
  const origin = process.env.BLUESURF_ORIGIN;
  if (origin) overlay.surf = { ...(overlay.surf ?? {}), origin };
  const project = process.env.BLUESURF_PROJECT;
  if (project) overlay.surf = { ...(overlay.surf ?? {}), project_code: project };
  const vault = process.env.OBSIDIAN_VAULT;
  const workstoreKind = base.workstore?.kind;
  const hasWorkstoreRoot = Boolean(base.workstore?.root?.trim());
  if (vault && workstoreKind !== "repo" && !hasWorkstoreRoot) {
    overlay.workstore = {
      ...(overlay.workstore ?? {}),
      kind: "path",
      root: vault,
    };
  }
  const tickets = process.env.OBSIDIAN_TICKETS_DIR;
  const sprints = process.env.OBSIDIAN_SPRINTS_DIR;
  if (tickets || sprints) {
    overlay.workstore = overlay.workstore ?? {};
    overlay.workstore.layout = {
      ...(overlay.workstore.layout ?? {}),
      ...(tickets ? { tickets } : {}),
      ...(sprints ? { sprints } : {}),
    };
  }
  if (Object.keys(overlay).length === 0) return base;
  return deepMerge(base, overlay);
}

/**
 * Load merged config: defaults → global config.toml → project.toml → env/.env legacy.
 */
export async function loadMergedConfig({
  cwd = process.cwd(),
  home = userHome(),
  projectCodeOverride = undefined,
} = {}) {
  let merged = defaultConfig();
  const globalPath = globalConfigPath(home);
  const hasGlobal = await pathExists(globalPath);
  if (hasGlobal) {
    merged = deepMerge(merged, await readTomlFile(globalPath));
  }

  const projectRoot = await findProjectRoot(cwd);
  let projectDoc = null;
  if (projectRoot) {
    const projectPath = projectConfigPath(projectRoot);
    if (await pathExists(projectPath)) {
      projectDoc = await readTomlFile(projectPath);
      const { project_code: code, ...rest } = projectDoc;
      merged = deepMerge(merged, rest);
      if (code) merged.surf.project_code = code;
    }
  }

  if (process.env.BLUESURF_SKIP_LEGACY_ENV !== "1") {
    await loadEnvFile(path.join(packageRoot(), ".env"));
  }
  merged = overlayFromEnv(merged);

  if (projectCodeOverride) {
    merged.surf.project_code = projectCodeOverride;
  }

  return {
    config: merged,
    projectRoot,
    globalPath,
    hasGlobal,
    projectDoc,
  };
}