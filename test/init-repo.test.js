import { describe, it, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { lstat, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { readTomlFile, writeTomlFile } from "../src/config/toml.js";
import { initRepo } from "../src/init-repo.js";
import { projectConfigPath } from "../src/paths.js";

const exec = promisify(execFile);

describe("initRepo", () => {
  let root;

  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), "bluesurf-init-"));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it("writes an inheriting project file in a git root and leaves a second AGENTS.md alone", async () => {
    const repo = path.join(root, "app");
    await mkdir(repo);
    await gitInit(repo);

    const first = await initRepo({ cwd: repo, projectCode: "PRY", stdinIsTTY: false });
    const doc = await readTomlFile(first.projectPath);
    assert.equal(doc.project_code, "PRY");
    assert.equal(doc.workstore, undefined);
    assert.match(await readFile(first.agentsPath, "utf8"), /Ticket done/);
    await assert.rejects(lstat(path.join(repo, ".bluesurf")));

    await writeFile(first.agentsPath, "KEEP\n");
    await writeFile(path.join(repo, ".cursor", "rules", "bluesurf-project.mdc"), "RULE\n");
    await initRepo({ cwd: repo, projectCode: "PRY", stdinIsTTY: false });
    assert.equal(await readFile(first.agentsPath, "utf8"), "KEEP\n");
    assert.equal(await readFile(path.join(repo, ".cursor", "rules", "bluesurf-project.mdc"), "utf8"), "RULE\n");
  });

  it("adds and removes the .bluesurf gitignore line with the tracked answer", async () => {
    const repo = path.join(root, "app");
    await mkdir(repo);
    await gitInit(repo);
    await writeFile(path.join(repo, ".gitignore"), "node_modules/\n");

    await initRepo({ cwd: repo, argv: ["--in-repo"], stdinIsTTY: false });
    assert.equal((await lstat(path.join(repo, ".bluesurf"))).isDirectory(), true);
    assert.match(await readFile(path.join(repo, ".gitignore"), "utf8"), /node_modules\/\n\.bluesurf\/\n/);
    const trackedOff = await readTomlFile(projectConfigPath(repo));
    assert.equal(trackedOff.workstore.vcs.tracked, false);

    await initRepo({ cwd: repo, argv: ["--in-repo", "--tracked"], stdinIsTTY: false });
    assert.equal(await readFile(path.join(repo, ".gitignore"), "utf8"), "node_modules/\n");
    const trackedOn = await readTomlFile(projectConfigPath(repo));
    assert.equal(trackedOn.workstore.vcs.tracked, true);
    assert.equal((await lstat(path.join(repo, ".bluesurf"))).isDirectory(), true);
  });

  it("keeps hand-edited project keys and the folder when init goes back to the global workstore", async () => {
    const repo = path.join(root, "app");
    await mkdir(repo);
    await gitInit(repo);
    await initRepo({ cwd: repo, argv: ["--in-repo"], stdinIsTTY: false, projectCode: "PRY" });
    const doc = await readTomlFile(projectConfigPath(repo));
    doc.ticket = { done: { delete_folder: false } };
    await writeTomlFile(projectConfigPath(repo), doc);

    await initRepo({
      cwd: repo,
      stdinIsTTY: true,
      projectCode: "PRY",
      ask: async (key, answers) => {
        if (key === "confirmRoot") return true;
        if (key === "workstoreKind") return "inherit";
        if (key === "projectCode") return answers.projectCode;
        throw new Error(key);
      },
    });

    const next = await readTomlFile(projectConfigPath(repo));
    assert.equal(next.project_code, "PRY");
    assert.equal(next.workstore, undefined);
    assert.equal(next.ticket.done.delete_folder, false);
    assert.equal((await lstat(path.join(repo, ".bluesurf"))).isDirectory(), true);
    assert.match(await readFile(path.join(repo, ".gitignore"), "utf8"), /\.bluesurf\//);
  });

  it("names --cwd and writes nothing outside a git root or in a nested directory", async () => {
    const plain = path.join(root, "plain");
    await mkdir(plain);
    await assert.rejects(() => initRepo({ cwd: plain, stdinIsTTY: false }), /--cwd/);
    await assert.rejects(lstat(path.join(plain, "AGENTS.md")));

    const repo = path.join(root, "app");
    const nested = path.join(repo, "packages");
    await mkdir(nested, { recursive: true });
    await gitInit(repo);
    await assert.rejects(() => initRepo({ cwd: nested, stdinIsTTY: false }), /--cwd/);
    await assert.rejects(lstat(path.join(nested, ".surf")));
    await assert.rejects(lstat(path.join(repo, "AGENTS.md")));
  });

  it("writes nothing when the git root confirm is declined", async () => {
    const repo = path.join(root, "app");
    await mkdir(repo);
    await gitInit(repo);
    await assert.rejects(
      () => initRepo({
        cwd: repo,
        stdinIsTTY: true,
        ask: async (key) => (key === "confirmRoot" ? false : null),
      }),
      /--cwd/,
    );
    await assert.rejects(lstat(path.join(repo, "AGENTS.md")));
    await assert.rejects(lstat(path.join(repo, ".surf")));
  });

  it("uses --cwd for a directory that is not the git root", async () => {
    const target = path.join(root, "chosen");
    await mkdir(target);
    const result = await initRepo({
      cwd: root,
      argv: ["--cwd", target, "--project", "PRY"],
      stdinIsTTY: false,
    });
    assert.equal(result.projectCode, "PRY");
    assert.equal((await readTomlFile(result.projectPath)).project_code, "PRY");
    assert.match(await readFile(result.agentsPath, "utf8"), /Ticket done/);
  });
});

async function gitInit(dir) {
  await exec("git", ["init"], { cwd: dir });
}
