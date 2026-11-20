import os from "node:os";
import path from "node:path";
import { createVault } from "./vault.js";
import { loadMergedConfig } from "./config/load.js";
import { resolveWorkstore } from "./workstore-resolve.js";
import { packageRoot, pathExists, sessionDir, userHome } from "./paths.js";

/** Session files: prefer XDG; fall back to package root for legacy clone workflows. */
export async function sessionPaths(home = userHome()) {
  const legacyRoot = packageRoot();
  const modernDir = sessionDir(home);
  const modernCookies = path.join(modernDir, "surf-cookies.json");
  const legacyCookies = path.join(legacyRoot, ".surf-cookies.json");
  const isolatedHome = path.resolve(home) !== path.resolve(os.homedir());
  if (isolatedHome) {
    return {
      profileDir: path.join(modernDir, "chrome-profile"),
      cookieJarPath: modernCookies,
    };
  }
  const [hasModernCookies, hasLegacyCookies] = await Promise.all([
    pathExists(modernCookies),
    pathExists(legacyCookies),
  ]);
  const useModern = hasModernCookies || !hasLegacyCookies;
  if (useModern) {
    return {
      profileDir: path.join(modernDir, "chrome-profile"),
      cookieJarPath: modernCookies,
    };
  }
  return {
    profileDir: path.join(legacyRoot, ".chrome-profile"),
    cookieJarPath: legacyCookies,
  };
}

export async function loadRuntimeContext(options = {}) {
  const home = options.home ?? userHome();
  const cwd = options.cwd ?? process.cwd();
  const { config, projectRoot, globalPath, hasGlobal } = await loadMergedConfig({
    cwd,
    home,
    projectCodeOverride: options.projectCode,
  });
  const workstore = resolveWorkstore({ config, cwd, projectRoot, home });
  const vault = createVault({
    root: workstore.root,
    ticketsDir: workstore.ticketsDir,
    sprintsDir: workstore.sprintsDir,
  });
  const session = await sessionPaths(home);
  const skillsRoot = config.skills?.source?.trim() || packageRoot();
  return {
    config,
    projectRoot,
    globalPath,
    hasGlobal,
    workstore,
    vault,
    origin: config.surf?.origin,
    projectCode: workstore.projectCode,
    session,
    skillsRoot,
    packageRoot: packageRoot(),
  };
}