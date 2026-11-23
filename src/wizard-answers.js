import os from "node:os";
import path from "node:path";
import { localWorkstoreRoot } from "./paths.js";

export const HARNESS_ORDER = ["cursor", "codex", "claude"];

const HARNESS_FLAGS = {
  "--cursor": "cursor",
  "--codex": "codex",
  "--claude": "claude",
};

const AFTER_PULL = new Set(["ask", "grill", "implement"]);

const SETUP_PROMPTS = [
  "harnesses",
  "workstoreKind",
  "workstoreRoot",
  "ticketsDir",
  "sprintsDir",
  "projectCode",
  "deleteFolder",
  "downloadAttachments",
  "afterPull",
];

const INIT_PROMPTS = ["confirmRoot", "projectCode", "workstoreKind", "tracked"];

function fail(error) {
  return { ok: false, error };
}

function hasPrompted(prompted, key) {
  return prompted != null && Object.hasOwn(prompted, key);
}

export function resolveUserPath(input, cwd, home) {
  let value = String(input ?? "").trim();
  if (value === "~") value = home;
  else if (value.startsWith("~/") || value.startsWith("~\\")) value = path.join(home, value.slice(2));
  return path.resolve(cwd, value);
}

function enabledHarnesses(existing) {
  const list = existing?.harnesses?.enabled;
  if (!Array.isArray(list)) return [];
  return HARNESS_ORDER.filter((name) => list.includes(name));
}

function parseValueFlag(argv, index, flag) {
  const value = argv[index + 1];
  if (value == null || value.startsWith("-")) {
    return { error: `${flag} needs a value.` };
  }
  return { value, index: index + 1 };
}

function parseSetupArgv(argv) {
  const parsed = {
    all: false,
    harnesses: [],
    workstoreKind: undefined,
    workstoreRoot: undefined,
    ticketsDir: undefined,
    sprintsDir: undefined,
    projectCode: undefined,
    deleteFolder: undefined,
    downloadAttachments: undefined,
    afterPull: undefined,
  };
  const seenDelete = [];
  const seenAttachments = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--all") {
      parsed.all = true;
      continue;
    }
    if (HARNESS_FLAGS[arg]) {
      parsed.harnesses.push(HARNESS_FLAGS[arg]);
      continue;
    }
    if (arg === "--workstore") {
      const next = parseValueFlag(argv, i, arg);
      if (next.error) return { error: next.error };
      i = next.index;
      if (next.value === "repo") {
        return { error: "Setup cannot select a repo workstore. Use bluesurf init --in-repo." };
      }
      if (next.value !== "path" && next.value !== "local") {
        return { error: "--workstore must be path or local." };
      }
      if (parsed.workstoreKind && parsed.workstoreKind !== next.value) {
        return { error: "Pass --workstore once." };
      }
      parsed.workstoreKind = next.value;
      continue;
    }
    if (arg === "--workstore-root") {
      const next = parseValueFlag(argv, i, arg);
      if (next.error) return { error: next.error };
      i = next.index;
      if (!next.value.trim()) return { error: "--workstore-root needs a path." };
      parsed.workstoreRoot = next.value;
      continue;
    }
    if (arg === "--tickets-dir" || arg === "--sprints-dir") {
      const next = parseValueFlag(argv, i, arg);
      if (next.error) return { error: next.error };
      i = next.index;
      if (!next.value.trim()) return { error: `${arg} needs a name.` };
      if (arg === "--tickets-dir") parsed.ticketsDir = next.value.trim();
      else parsed.sprintsDir = next.value.trim();
      continue;
    }
    if (arg === "--project") {
      const next = parseValueFlag(argv, i, arg);
      if (next.error) return { error: next.error };
      i = next.index;
      if (!next.value.trim()) return { error: "--project needs a code." };
      parsed.projectCode = next.value.trim();
      continue;
    }
    if (arg === "--delete-folder" || arg === "--no-delete-folder") {
      seenDelete.push(arg);
      parsed.deleteFolder = arg === "--delete-folder";
      continue;
    }
    if (arg === "--download-attachments" || arg === "--no-download-attachments") {
      seenAttachments.push(arg);
      parsed.downloadAttachments = arg === "--download-attachments";
      continue;
    }
    if (arg === "--after-pull") {
      const next = parseValueFlag(argv, i, arg);
      if (next.error) return { error: next.error };
      i = next.index;
      if (!AFTER_PULL.has(next.value)) {
        return { error: "--after-pull must be ask, grill, or implement." };
      }
      parsed.afterPull = next.value;
      continue;
    }
    if (arg.startsWith("-")) return { error: `Unknown argument ${arg}.` };
    return { error: `Unexpected argument ${arg}.` };
  }

  if (seenDelete.length > 1 && seenDelete.includes("--delete-folder") && seenDelete.includes("--no-delete-folder")) {
    return { error: "Pass only one of --delete-folder or --no-delete-folder." };
  }
  if (
    seenAttachments.length > 1
    && seenAttachments.includes("--download-attachments")
    && seenAttachments.includes("--no-download-attachments")
  ) {
    return { error: "Pass only one of --download-attachments or --no-download-attachments." };
  }
  if (parsed.workstoreKind === "local" && parsed.workstoreRoot) {
    return { error: "Don't pass --workstore-root with --workstore local." };
  }
  return { parsed };
}

function textAnswer(flagValue, prompted, key, existingValue, fallback) {
  if (flagValue != null) return { value: flagValue, locked: true };
  if (hasPrompted(prompted, key)) {
    const text = String(prompted[key] ?? "").trim();
    return { value: text || existingValue || fallback, locked: true };
  }
  return { value: existingValue || fallback, locked: false };
}

function boolAnswer(flagValue, prompted, key, existingValue, fallback) {
  if (flagValue != null) return { value: flagValue, locked: true };
  if (hasPrompted(prompted, key)) return { value: Boolean(prompted[key]), locked: true };
  if (existingValue != null) return { value: Boolean(existingValue), locked: false };
  return { value: fallback, locked: false };
}

/**
 * Resolve bluesurf setup wizard answers.
 * Flag, then process env, then the existing config file.
 * A terminal still asks every question this run did not lock with a flag or env value.
 */
export function resolveSetupAnswers({
  argv = [],
  env = {},
  existing = null,
  stdinIsTTY = false,
  cwd = process.cwd(),
  home = os.homedir(),
  prompted = null,
} = {}) {
  const parsedResult = parseSetupArgv(argv);
  if (parsedResult.error) return fail(parsedResult.error);
  const parsed = parsedResult.parsed;

  const savedHarnesses = enabledHarnesses(existing);
  const preselect = savedHarnesses.length > 0 ? savedHarnesses : [...HARNESS_ORDER];
  const harnessFromFlags = parsed.all || parsed.harnesses.length > 0;
  let harnesses;
  let removedHarnesses = [];
  if (parsed.all) harnesses = [...HARNESS_ORDER];
  else if (parsed.harnesses.length > 0) {
    harnesses = HARNESS_ORDER.filter((name) => savedHarnesses.includes(name) || parsed.harnesses.includes(name));
  } else if (hasPrompted(prompted, "harnesses")) {
    const picked = prompted.harnesses ?? [];
    if (!Array.isArray(picked) || picked.length === 0) {
      return fail("Choose at least one harness, or pass --all.");
    }
    const unknown = picked.find((name) => !HARNESS_ORDER.includes(name));
    if (unknown) return fail(`Unknown harness ${unknown}.`);
    harnesses = HARNESS_ORDER.filter((name) => picked.includes(name));
    removedHarnesses = preselect.filter((name) => !harnesses.includes(name));
  } else harnesses = preselect;

  let kind = parsed.workstoreKind;
  let root = parsed.workstoreRoot;
  const kindFromFlag = parsed.workstoreKind != null;
  const rootFromFlag = parsed.workstoreRoot != null;
  let kindFromEnv = false;
  let rootFromEnv = false;

  if (!kindFromFlag && env.BLUESURF_WORKSTORE_KIND === "local") {
    kind = "local";
    kindFromEnv = true;
  }
  const envRoot = env.OBSIDIAN_VAULT || env.BLUESURF_WORKSTORE_ROOT;
  if (!rootFromFlag && envRoot && kind !== "local") {
    root = envRoot;
    rootFromEnv = true;
    if (!kind) {
      kind = "path";
      kindFromEnv = true;
    }
  }

  if (!kind && !kindFromEnv && !kindFromFlag) {
    const savedKind = existing?.workstore?.kind;
    if (savedKind === "path" || savedKind === "local") kind = savedKind;
  }
  if (!root && !rootFromFlag && !rootFromEnv && existing?.workstore?.root) {
    root = existing.workstore.root;
  }

  if (hasPrompted(prompted, "workstoreKind")) {
    const picked = prompted.workstoreKind;
    if (picked !== "path" && picked !== "local") return fail("Workstore kind must be path or local.");
    kind = picked;
  }
  if (hasPrompted(prompted, "workstoreRoot")) {
    root = String(prompted.workstoreRoot ?? "");
  }

  const tickets = textAnswer(
    parsed.ticketsDir,
    prompted,
    "ticketsDir",
    existing?.workstore?.layout?.tickets,
    "Tickets",
  );
  const sprints = textAnswer(
    parsed.sprintsDir,
    prompted,
    "sprintsDir",
    existing?.workstore?.layout?.sprints,
    "Sprints",
  );
  const project = textAnswer(parsed.projectCode, prompted, "projectCode", existing?.surf?.project_code, "RLD");
  const deleteFolder = boolAnswer(
    parsed.deleteFolder,
    prompted,
    "deleteFolder",
    existing?.ticket?.done?.delete_folder,
    true,
  );
  const downloadAttachments = boolAnswer(
    parsed.downloadAttachments,
    prompted,
    "downloadAttachments",
    existing?.pull?.download_attachments,
    true,
  );
  const afterPull = textAnswer(parsed.afterPull, prompted, "afterPull", existing?.ticket?.after_pull, "ask");
  if (!AFTER_PULL.has(afterPull.value)) return fail("--after-pull must be ask, grill, or implement.");

  const prompt = [];
  if (!harnessFromFlags && !hasPrompted(prompted, "harnesses")) {
    if (stdinIsTTY) prompt.push("harnesses");
    else if (savedHarnesses.length === 0 && !parsed.all) {
      return fail("No harness selected. Re-run with --cursor, --codex, --claude, or --all.");
    }
  }

  const kindLocked = kindFromFlag || kindFromEnv;
  const rootLocked = rootFromFlag || rootFromEnv;
  if (!kindLocked && !hasPrompted(prompted, "workstoreKind")) {
    if (stdinIsTTY) prompt.push("workstoreKind");
    else if (kind !== "local" && !(kind === "path" && String(root ?? "").trim())) {
      return fail("Pass --workstore-root <path> or --workstore local.");
    }
  }

  if (kind === "path" && !rootLocked && !hasPrompted(prompted, "workstoreRoot")) {
    if (stdinIsTTY) prompt.push("workstoreRoot");
    else if (!String(root ?? "").trim()) return fail("Pass --workstore-root <path> or --workstore local.");
  }
  if (hasPrompted(prompted, "workstoreRoot") && kind === "path" && !String(root ?? "").trim()) {
    return fail("Workstore path is required.");
  }

  for (const [key, answer] of [
    ["ticketsDir", tickets],
    ["sprintsDir", sprints],
    ["projectCode", project],
    ["deleteFolder", deleteFolder],
    ["downloadAttachments", downloadAttachments],
    ["afterPull", afterPull],
  ]) {
    if (!answer.locked && stdinIsTTY) prompt.push(key);
  }

  let workstoreRoot;
  let directory;
  if (kind === "local") {
    directory = localWorkstoreRoot(project.value, home);
    workstoreRoot = "";
  } else if (kind === "path" && String(root ?? "").trim()) {
    workstoreRoot = resolveUserPath(root, cwd, home);
    directory = workstoreRoot;
  }

  const orderedPrompt = SETUP_PROMPTS.filter((key) => prompt.includes(key));

  return {
    ok: true,
    prompt: orderedPrompt,
    answers: {
      harnesses,
      removedHarnesses,
      workstoreKind: kind === "local" || kind === "path" ? kind : undefined,
      workstoreRoot,
      directory,
      ticketsDir: tickets.value,
      sprintsDir: sprints.value,
      projectCode: project.value,
      deleteFolder: deleteFolder.value,
      downloadAttachments: downloadAttachments.value,
      afterPull: afterPull.value,
    },
  };
}

function parseInitArgv(argv) {
  const parsed = {
    cwd: undefined,
    projectCode: undefined,
    inRepo: false,
    tracked: undefined,
  };
  const seenTracked = [];

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cwd" || arg === "--project") {
      const next = parseValueFlag(argv, i, arg);
      if (next.error) return { error: next.error };
      i = next.index;
      if (!next.value.trim()) return { error: `${arg} needs a value.` };
      if (arg === "--cwd") parsed.cwd = next.value.trim();
      else parsed.projectCode = next.value.trim();
      continue;
    }
    if (arg === "--in-repo") {
      parsed.inRepo = true;
      continue;
    }
    if (arg === "--tracked" || arg === "--no-tracked") {
      seenTracked.push(arg);
      parsed.tracked = arg === "--tracked";
      continue;
    }
    if (arg.startsWith("-")) return { error: `Unknown argument ${arg}.` };
    return { error: `Unexpected argument ${arg}.` };
  }

  if (seenTracked.includes("--tracked") && seenTracked.includes("--no-tracked")) {
    return { error: "Pass only one of --tracked or --no-tracked." };
  }
  if (parsed.tracked != null && !parsed.inRepo) {
    const flag = parsed.tracked ? "--tracked" : "--no-tracked";
    return { error: `${flag} requires --in-repo.` };
  }
  return { parsed };
}

/**
 * Resolve bluesurf init wizard answers.
 * gitToplevel is null when cwd is not inside a git repo.
 * Pass cwd and gitToplevel already normalized (realpath) so a symlink temp dir matches.
 */
export function resolveInitAnswers({
  argv = [],
  stdinIsTTY = false,
  cwd = process.cwd(),
  home = os.homedir(),
  gitToplevel = null,
  projectCode: inheritedCode = "RLD",
  projectDoc = null,
  prompted = null,
} = {}) {
  const parsedResult = parseInitArgv(argv);
  if (parsedResult.error) return fail(parsedResult.error);
  const parsed = parsedResult.parsed;

  const prompt = [];
  let repoRoot;
  if (parsed.cwd) {
    repoRoot = resolveUserPath(parsed.cwd, cwd, home);
  } else if (!gitToplevel) {
    return fail("Pass --cwd <path>. This directory is not a git repository.");
  } else if (!stdinIsTTY) {
    if (path.resolve(cwd) !== path.resolve(gitToplevel)) {
      return fail("Pass --cwd <path>. Init continues in the git root when there is no terminal.");
    }
    repoRoot = path.resolve(gitToplevel);
  } else if (hasPrompted(prompted, "confirmRoot")) {
    if (!prompted.confirmRoot) return fail("Pass --cwd <path> to choose a different root.");
    repoRoot = path.resolve(gitToplevel);
  } else {
    prompt.push("confirmRoot");
    repoRoot = path.resolve(gitToplevel);
  }

  const savedCode = projectDoc?.project_code || inheritedCode || "RLD";
  const project = textAnswer(parsed.projectCode, prompted, "projectCode", savedCode, "RLD");

  const savedKind = projectDoc?.workstore?.kind === "repo" ? "repo" : "inherit";
  let workstoreKind = savedKind;
  if (parsed.inRepo) workstoreKind = "repo";
  else if (hasPrompted(prompted, "workstoreKind")) {
    if (prompted.workstoreKind !== "repo" && prompted.workstoreKind !== "inherit") {
      return fail("Workstore must be inherit or repo.");
    }
    workstoreKind = prompted.workstoreKind;
  } else if (stdinIsTTY) prompt.push("workstoreKind");

  let tracked = projectDoc?.workstore?.vcs?.tracked === true;
  const trackedLocked = parsed.tracked != null;
  if (workstoreKind === "repo") {
    if (trackedLocked) tracked = parsed.tracked;
    else if (hasPrompted(prompted, "tracked")) tracked = Boolean(prompted.tracked);
    else if (stdinIsTTY) {
      prompt.push("tracked");
      tracked = projectDoc?.workstore?.vcs?.tracked === true;
    }
  } else tracked = false;

  if (!project.locked && stdinIsTTY) prompt.push("projectCode");

  return {
    ok: true,
    prompt: INIT_PROMPTS.filter((key) => prompt.includes(key)),
    answers: {
      repoRoot,
      projectCode: project.value,
      workstoreKind,
      tracked: workstoreKind === "repo" ? tracked : false,
    },
  };
}
