import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveInitAnswers, resolveSetupAnswers } from "../src/wizard-answers.js";

describe("resolveSetupAnswers", () => {
  it("names the workstore flags when a first non-terminal setup has no workstore", () => {
    const result = resolveSetupAnswers({
      argv: ["--all"],
      env: {},
      existing: null,
      stdinIsTTY: false,
    });

    assert.equal(result.ok, false);
    assert.match(result.error, /--workstore-root/);
    assert.match(result.error, /--workstore local/);
  });

  it("accepts a non-terminal local workstore and stores a home path", () => {
    const result = resolveSetupAnswers({
      argv: ["--all", "--workstore", "local", "--project", "PRY"],
      env: {},
      existing: null,
      stdinIsTTY: false,
      home: "/Users/pato",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.prompt, []);
    assert.deepEqual(result.answers.harnesses, ["cursor", "codex", "claude"]);
    assert.equal(result.answers.workstoreKind, "local");
    assert.equal(result.answers.directory, "/Users/pato/.local/share/bluesurf/workstore/PRY");
    assert.equal(result.answers.projectCode, "PRY");
    assert.equal(result.answers.deleteFolder, true);
    assert.equal(result.answers.afterPull, "ask");
  });

  it("stores a tilde workstore root as an absolute path", () => {
    const result = resolveSetupAnswers({
      argv: ["--all", "--workstore", "path", "--workstore-root", "~/vault"],
      env: {},
      existing: null,
      stdinIsTTY: false,
      cwd: "/work",
      home: "/Users/pato",
    });

    assert.equal(result.ok, true);
    assert.equal(result.answers.workstoreRoot, "/Users/pato/vault");
  });

  it("lets a process env workstore skip the prompt in a terminal", () => {
    const result = resolveSetupAnswers({
      argv: ["--all"],
      env: { OBSIDIAN_VAULT: "/vault" },
      existing: null,
      stdinIsTTY: true,
      cwd: "/work",
      home: "/Users/pato",
    });

    assert.equal(result.ok, true);
    assert.equal(result.prompt.includes("workstoreKind"), false);
    assert.equal(result.prompt.includes("workstoreRoot"), false);
    assert.equal(result.answers.workstoreRoot, "/vault");
    assert.equal(result.prompt.includes("projectCode"), true);
  });

  it("does not read OBSIDIAN_VAULT from anywhere except the env argument", () => {
    const previous = process.env.OBSIDIAN_VAULT;
    process.env.OBSIDIAN_VAULT = "/from-process";
    try {
      const result = resolveSetupAnswers({
        argv: ["--all"],
        env: {},
        existing: null,
        stdinIsTTY: false,
      });
      assert.equal(result.ok, false);
      assert.match(result.error, /--workstore-root/);
    } finally {
      if (previous === undefined) delete process.env.OBSIDIAN_VAULT;
      else process.env.OBSIDIAN_VAULT = previous;
    }
  });

  it("asks the spec questions in a terminal when nothing was passed", () => {
    const result = resolveSetupAnswers({
      argv: [],
      env: {},
      existing: null,
      stdinIsTTY: true,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.prompt, [
      "harnesses",
      "workstoreKind",
      "ticketsDir",
      "sprintsDir",
      "projectCode",
      "deleteFolder",
      "downloadAttachments",
      "afterPull",
    ]);
    assert.deepEqual(result.answers.harnesses, ["cursor", "codex", "claude"]);
    assert.equal(result.answers.projectCode, "RLD");
    assert.equal(result.answers.ticketsDir, "Tickets");
  });

  it("asks for a path only after the kind is path", () => {
    const waiting = resolveSetupAnswers({
      argv: ["--all"],
      env: {},
      existing: null,
      stdinIsTTY: true,
    });
    assert.equal(waiting.prompt.includes("workstoreRoot"), false);

    const pathKind = resolveSetupAnswers({
      argv: ["--all"],
      env: {},
      existing: null,
      stdinIsTTY: true,
      prompted: { workstoreKind: "path" },
    });
    assert.equal(pathKind.prompt.includes("workstoreRoot"), true);

    const local = resolveSetupAnswers({
      argv: ["--all"],
      env: {},
      existing: null,
      stdinIsTTY: true,
      prompted: { workstoreKind: "local" },
    });
    assert.equal(local.prompt.includes("workstoreRoot"), false);
  });

  it("rejects contradictory workstore, boolean, and after-pull flags", () => {
    const localAndRoot = resolveSetupAnswers({
      argv: ["--all", "--workstore", "local", "--workstore-root", "/vault"],
      env: {},
      stdinIsTTY: false,
    });
    assert.match(localAndRoot.error, /--workstore-root/);
    assert.match(localAndRoot.error, /--workstore local/);

    const repo = resolveSetupAnswers({
      argv: ["--workstore", "repo"],
      env: {},
      stdinIsTTY: false,
    });
    assert.match(repo.error, /--in-repo/);

    const bothDelete = resolveSetupAnswers({
      argv: ["--delete-folder", "--no-delete-folder"],
      env: {},
      stdinIsTTY: false,
    });
    assert.match(bothDelete.error, /--delete-folder/);
    assert.match(bothDelete.error, /--no-delete-folder/);

    const after = resolveSetupAnswers({
      argv: ["--after-pull", "ship"],
      env: {},
      stdinIsTTY: false,
    });
    assert.match(after.error, /ask, grill, or implement/);

    const unknown = resolveSetupAnswers({ argv: ["--vim"], env: {}, stdinIsTTY: true });
    assert.match(unknown.error, /--vim/);
  });

  it("adds a harness flag to the saved list and lets --all enable all three", () => {
    const added = resolveSetupAnswers({
      argv: ["--codex"],
      env: { OBSIDIAN_VAULT: "/vault" },
      existing: { harnesses: { enabled: ["cursor"] } },
      stdinIsTTY: false,
      cwd: "/work",
    });
    assert.deepEqual(added.answers.harnesses, ["cursor", "codex"]);
    assert.deepEqual(added.answers.removedHarnesses, []);

    const all = resolveSetupAnswers({
      argv: ["--all"],
      env: { OBSIDIAN_VAULT: "/vault" },
      existing: { harnesses: { enabled: ["cursor"] } },
      stdinIsTTY: false,
      cwd: "/work",
    });
    assert.deepEqual(all.answers.harnesses, ["cursor", "codex", "claude"]);
  });

  it("uses the saved config on a later non-terminal run and keeps unprompted keys in the answers", () => {
    const result = resolveSetupAnswers({
      argv: [],
      env: {},
      existing: {
        surf: { project_code: "PRY" },
        harnesses: { enabled: ["cursor"] },
        workstore: { kind: "path", root: "/vault", layout: { tickets: "Proyect/Tickets", sprints: "Sprints" } },
        ticket: { after_pull: "grill", done: { delete_folder: false } },
        pull: { download_attachments: false },
      },
      stdinIsTTY: false,
      cwd: "/work",
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.prompt, []);
    assert.deepEqual(result.answers.harnesses, ["cursor"]);
    assert.equal(result.answers.projectCode, "PRY");
    assert.equal(result.answers.workstoreRoot, "/vault");
    assert.equal(result.answers.ticketsDir, "Proyect/Tickets");
    assert.equal(result.answers.deleteFolder, false);
    assert.equal(result.answers.downloadAttachments, false);
    assert.equal(result.answers.afterPull, "grill");
  });

  it("still asks in a terminal when the config file already has a project code", () => {
    const result = resolveSetupAnswers({
      argv: ["--all"],
      env: { BLUESURF_WORKSTORE_KIND: "local" },
      existing: { surf: { project_code: "PRY" }, harnesses: { enabled: ["cursor"] } },
      stdinIsTTY: true,
      home: "/Users/pato",
    });

    assert.equal(result.prompt.includes("harnesses"), false);
    assert.equal(result.prompt.includes("projectCode"), true);
    assert.equal(result.answers.projectCode, "PRY");
  });

  it("treats a cleared harness multiselect as the full list and a blank folder name as the default", () => {
    const cleared = resolveSetupAnswers({
      argv: [],
      env: { OBSIDIAN_VAULT: "/vault" },
      existing: { harnesses: { enabled: ["cursor", "claude"] } },
      stdinIsTTY: true,
      cwd: "/work",
      prompted: {
        harnesses: ["cursor"],
        ticketsDir: "  ",
        sprintsDir: "Sprints",
        projectCode: "RLD",
        deleteFolder: true,
        downloadAttachments: true,
        afterPull: "ask",
      },
    });

    assert.equal(cleared.ok, true);
    assert.deepEqual(cleared.answers.harnesses, ["cursor"]);
    assert.deepEqual(cleared.answers.removedHarnesses, ["claude"]);
    assert.equal(cleared.answers.ticketsDir, "Tickets");

    const empty = resolveSetupAnswers({
      argv: [],
      env: { OBSIDIAN_VAULT: "/vault" },
      existing: null,
      stdinIsTTY: true,
      prompted: { harnesses: [] },
    });
    assert.equal(empty.ok, false);
    assert.match(empty.error, /--all/);
  });
});

describe("resolveInitAnswers", () => {
  it("inherits on a non-terminal run in the git root", () => {
    const result = resolveInitAnswers({
      argv: [],
      stdinIsTTY: false,
      cwd: "/repo",
      gitToplevel: "/repo",
      projectCode: "RLD",
      projectDoc: null,
    });

    assert.equal(result.ok, true);
    assert.deepEqual(result.prompt, []);
    assert.equal(result.answers.repoRoot, "/repo");
    assert.equal(result.answers.projectCode, "RLD");
    assert.equal(result.answers.workstoreKind, "inherit");
  });

  it("names --cwd when cwd is nested or not a git repo and there is no terminal", () => {
    const nested = resolveInitAnswers({
      argv: [],
      stdinIsTTY: false,
      cwd: "/repo/packages/app",
      gitToplevel: "/repo",
    });
    assert.equal(nested.ok, false);
    assert.match(nested.error, /--cwd/);

    const missing = resolveInitAnswers({
      argv: [],
      stdinIsTTY: true,
      cwd: "/tmp/notes",
      gitToplevel: null,
    });
    assert.equal(missing.ok, false);
    assert.match(missing.error, /--cwd/);
  });

  it("uses --cwd without a confirm and rejects a declined confirm", () => {
    const explicit = resolveInitAnswers({
      argv: ["--cwd", "~/app"],
      stdinIsTTY: true,
      cwd: "/work",
      home: "/Users/pato",
      gitToplevel: null,
    });
    assert.equal(explicit.ok, true);
    assert.equal(explicit.prompt.includes("confirmRoot"), false);
    assert.equal(explicit.answers.repoRoot, "/Users/pato/app");

    const declined = resolveInitAnswers({
      argv: [],
      stdinIsTTY: true,
      cwd: "/repo",
      gitToplevel: "/repo",
      prompted: { confirmRoot: false },
    });
    assert.equal(declined.ok, false);
    assert.match(declined.error, /--cwd/);
  });

  it("requires --in-repo before a tracked flag and defaults tracking off", () => {
    const missing = resolveInitAnswers({
      argv: ["--tracked"],
      stdinIsTTY: false,
      cwd: "/repo",
      gitToplevel: "/repo",
    });
    assert.match(missing.error, /--tracked/);
    assert.match(missing.error, /--in-repo/);

    const created = resolveInitAnswers({
      argv: ["--in-repo"],
      stdinIsTTY: false,
      cwd: "/repo",
      gitToplevel: "/repo",
    });
    assert.equal(created.ok, true);
    assert.equal(created.answers.workstoreKind, "repo");
    assert.equal(created.answers.tracked, false);
  });

  it("asks in a terminal and keeps a saved repo workstore on a non-terminal re-run", () => {
    const asking = resolveInitAnswers({
      argv: ["--in-repo"],
      stdinIsTTY: true,
      cwd: "/repo",
      gitToplevel: "/repo",
      projectDoc: { project_code: "PRY", workstore: { kind: "repo", vcs: { tracked: true } } },
    });
    assert.equal(asking.prompt.includes("workstoreKind"), false);
    assert.equal(asking.prompt.includes("tracked"), true);
    assert.equal(asking.answers.tracked, true);
    assert.equal(asking.answers.projectCode, "PRY");

    const again = resolveInitAnswers({
      argv: [],
      stdinIsTTY: false,
      cwd: "/repo",
      gitToplevel: "/repo",
      projectDoc: {
        project_code: "PRY",
        workstore: { kind: "repo", root: ".bluesurf", vcs: { tracked: true } },
        ticket: { done: { delete_folder: false } },
      },
    });
    assert.equal(again.ok, true);
    assert.equal(again.answers.workstoreKind, "repo");
    assert.equal(again.answers.tracked, true);
    assert.equal(again.answers.projectCode, "PRY");
  });
});
