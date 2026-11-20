import { access } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const moduleDir = path.dirname(fileURLToPath(import.meta.url));

/** Override home for tests: BLUESURF_HOME */
export function userHome() {
  return process.env.BLUESURF_HOME?.trim() || os.homedir();
}

/** Bluesurf package root (repo or global npm install). */
export function packageRoot() {
  return path.resolve(moduleDir, "..");
}

export function configDir(home = userHome()) {
  return path.join(home, ".config", "bluesurf");
}

export function globalConfigPath(home = userHome()) {
  return path.join(configDir(home), "config.toml");
}

export function stateDir(home = userHome()) {
  return (
    process.env.BLUESURF_STATE_DIR?.trim() ||
    path.join(home, ".local", "share", "bluesurf")
  );
}

export function sessionDir(home = userHome()) {
  return path.join(stateDir(home), "session");
}

export function localWorkstoreRoot(projectCode, home = userHome()) {
  const code = String(projectCode ?? "default").trim() || "default";
  return path.join(stateDir(home), "workstore", code);
}

export function projectConfigPath(repoRoot) {
  return path.join(repoRoot, ".surf", "project.toml");
}

export async function findProjectRoot(startDir) {
  let dir = path.resolve(startDir);
  while (true) {
    try {
      await access(projectConfigPath(dir));
      return dir;
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    const parent = path.dirname(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}

export async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}