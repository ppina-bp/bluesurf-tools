import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { loadMergedConfig } from "../src/config/load.js";
import { resolveWorkstore } from "../src/workstore-resolve.js";
import { writeTomlFile } from "../src/config/toml.js";
import { defaultConfig } from "../src/config/defaults.js";
import { getConfigValue } from "../src/config/merge.js";
import { ticketDoneCommand } from "../src/commands/ticket-done.js";

describe("config resolve", () => {
  let home;
  let repo;
  let tmp;

  beforeEach(async () => {
    process.env.BLUESURF_SKIP_LEGACY_ENV = "1";
    tmp = await mkdtemp(path.join(os.tmpdir(), "bluesurf-config-"));
    home = path.join(tmp, "home");
    repo = path.join(tmp, "repo");
    await mkdir(path.join(home, ".config", "bluesurf"), { recursive: true });
    await mkdir(repo, { recursive: true });
  });

  afterEach(async () => {
    delete process.env.BLUESURF_SKIP_LEGACY_ENV;
    await rm(tmp, { recursive: true, force: true });
  });

  it("merges project.toml overrides over global config", async () => {
    const globalPath = path.join(home, ".config", "bluesurf", "config.toml");
    await writeTomlFile(globalPath, {
      ...defaultConfig(),
      workstore: { kind: "path", root: "/global/vault", layout: { tickets: "Tickets", sprints: "Sprints" } },
      ticket: { done: { delete_folder: true } },
    });
    await mkdir(path.join(repo, ".surf"), { recursive: true });
    await writeTomlFile(path.join(repo, ".surf", "project.toml"), {
      version: 1,
      project_code: "PRY",
      ticket: { done: { delete_folder: false } },
    });
    const { config } = await loadMergedConfig({ cwd: repo, home });
    assert.equal(getConfigValue(config, "ticket.done.delete_folder"), false);
    assert.equal(config.surf.project_code, "PRY");
  });

  it("resolves repo workstore under project root", async () => {
    const globalPath = path.join(home, ".config", "bluesurf", "config.toml");
    await writeTomlFile(globalPath, defaultConfig());
    await mkdir(path.join(repo, ".surf"), { recursive: true });
    await writeTomlFile(path.join(repo, ".surf", "project.toml"), {
      version: 1,
      project_code: "PRY",
      workstore: { kind: "repo", root: ".bluesurf", layout: { tickets: "Tickets", sprints: "Sprints" } },
    });
    const { config } = await loadMergedConfig({ cwd: repo, home });
    const ws = resolveWorkstore({ config, cwd: repo, projectRoot: repo, home });
    assert.equal(ws.root, path.join(repo, ".bluesurf"));
    assert.equal(ws.ticketsDir, "Tickets");
  });

  it("ticket-done keeps folder when delete_folder is false", async () => {
    const globalPath = path.join(home, ".config", "bluesurf", "config.toml");
    const vaultRoot = path.join(tmp, "vault");
    await mkdir(path.join(vaultRoot, "Tickets", "RLD-1"), { recursive: true });
    await writeFile(path.join(vaultRoot, "Tickets", "RLD-1", "detail.md"), "# test");
    await writeTomlFile(globalPath, {
      ...defaultConfig(),
      surf: { origin: "https://surf.bluepeople.com", project_code: "RLD" },
      workstore: { kind: "path", root: vaultRoot, layout: { tickets: "Tickets", sprints: "Sprints" } },
      ticket: { done: { delete_folder: false } },
    });
    const previous = process.env.BLUESURF_HOME;
    process.env.BLUESURF_HOME = home;
    try {
      const code = await ticketDoneCommand(["RLD-1", "--cwd", repo]);
      assert.equal(code, 0);
      const { access } = await import("node:fs/promises");
      await access(path.join(vaultRoot, "Tickets", "RLD-1", "detail.md"));
    } finally {
      if (previous === undefined) delete process.env.BLUESURF_HOME;
      else process.env.BLUESURF_HOME = previous;
    }
  });
});