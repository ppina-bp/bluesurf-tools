import { access } from "node:fs/promises";
import { execSync } from "node:child_process";
import os from "node:os";
import { loadMergedConfig } from "./config/load.js";
import { findProjectRoot } from "./paths.js";
import { resolveWorkstore } from "./workstore-resolve.js";
import { sessionPaths } from "./runtime-context.js";

export async function runDoctor({ home = os.homedir(), cwd = process.cwd() } = {}) {
  const issues = [];
  const ok = [];

  try {
    if (process.platform === "win32") {
      execSync("where bluesurf", { stdio: "pipe" });
    } else {
      execSync("command -v bluesurf", { stdio: "pipe", shell: true });
    }
    ok.push("bluesurf is on PATH");
  } catch {
    issues.push("bluesurf not on PATH — run npm link from this repo or npm i -g @bluepeople/bluesurf");
  }

  let config;
  try {
    ({ config } = await loadMergedConfig({ cwd, home }));
    ok.push("configuration loaded");
  } catch (error) {
    issues.push(`config load failed: ${error.message}`);
    return { ok, issues };
  }

  try {
    const projectRoot = await findProjectRoot(cwd);
    const ws = resolveWorkstore({ config, cwd, projectRoot, home });
    await access(ws.root);
    ok.push(`workstore root: ${ws.root}`);
  } catch (error) {
    issues.push(error.message ?? String(error));
  }

  const session = await sessionPaths(home);
  try {
    await access(session.cookieJarPath);
    ok.push(`session: ${session.cookieJarPath}`);
  } catch {
    issues.push("no saved session — run bluesurf login");
  }

  const major = Number(process.versions.node.split(".")[0]);
  if (major < 22) {
    issues.push(
      `Node ${process.version}: use Node 22.20+ for skills@latest (setup pins older skills on Node < 22).`,
    );
  } else {
    ok.push(`Node ${process.version}`);
  }

  return { ok, issues };
}