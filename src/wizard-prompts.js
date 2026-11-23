import * as p from "@clack/prompts";

const HARNESS_OPTIONS = [
  { value: "cursor", label: "Cursor" },
  { value: "codex", label: "Codex" },
  { value: "claude", label: "Claude Code" },
];

export function wizardIntro(title) {
  p.intro(title);
}

export function wizardOutro(message) {
  p.outro(message);
}

export function wizardWarn(message) {
  p.log.warn(message);
}

export function createStepRunner() {
  const spin = p.spinner();
  return async (label, exec) => {
    spin.start(label);
    const result = await exec();
    if (!result || result.code !== 0) spin.error(label);
    else spin.stop(label);
    return result;
  };
}

export function createSetupAsk() {
  return (key, answers) => askOrCancel("Setup cancelled.", () => askSetup(key, answers));
}

export function createInitAsk() {
  return (key, answers) => askOrCancel("Init cancelled.", () => askInit(key, answers));
}

async function askOrCancel(message, ask) {
  const value = await ask();
  if (p.isCancel(value)) {
    p.cancel(message);
    return null;
  }
  return value;
}

function askSetup(key, answers) {
  if (key === "harnesses") {
    return p.multiselect({
      message: "Which harnesses should setup install?",
      options: HARNESS_OPTIONS,
      initialValues: answers.harnesses ?? [],
      required: true,
    });
  }
  if (key === "workstoreKind") {
    return p.select({
      message: "Where should ticket and sprint notes live?",
      options: [
        { value: "path", label: "A folder I choose" },
        { value: "local", label: "Under ~/.local/share/bluesurf/workstore/<project code>/" },
      ],
      initialValue: answers.workstoreKind ?? "path",
    });
  }
  if (key === "workstoreRoot") {
    return p.text({
      message: "Workstore folder",
      initialValue: answers.workstoreRoot || undefined,
      placeholder: "~/Notes",
      validate: (value) => (String(value ?? "").trim() ? undefined : "Path is required"),
    });
  }
  if (key === "ticketsDir") {
    return p.text({
      message: "Ticket folder, relative to the workstore",
      initialValue: answers.ticketsDir || "Tickets",
      placeholder: "Tickets",
    });
  }
  if (key === "sprintsDir") {
    return p.text({
      message: "Sprint folder, relative to the workstore",
      initialValue: answers.sprintsDir || "Sprints",
      placeholder: "Sprints",
    });
  }
  if (key === "projectCode") {
    return p.text({
      message: "Project code",
      initialValue: answers.projectCode || "RLD",
      placeholder: "RLD",
    });
  }
  if (key === "deleteFolder") {
    return p.confirm({
      message: "Delete the ticket folder when ticket-done runs?",
      initialValue: answers.deleteFolder !== false,
    });
  }
  if (key === "downloadAttachments") {
    return p.confirm({
      message: "Download attachments when pulling a ticket?",
      initialValue: answers.downloadAttachments !== false,
    });
  }
  if (key === "afterPull") {
    return p.select({
      message: "After a ticket is pulled",
      options: [
        { value: "ask", label: "Ask whether to grill or implement" },
        { value: "grill", label: "Grill" },
        { value: "implement", label: "Implement" },
      ],
      initialValue: answers.afterPull || "ask",
    });
  }
  throw new Error(`Unknown setup question ${key}.`);
}

function askInit(key, answers) {
  if (key === "confirmRoot") {
    return p.confirm({
      message: `Initialize ${answers.repoRoot}?`,
      initialValue: true,
    });
  }
  if (key === "projectCode") {
    return p.text({
      message: "Project code",
      initialValue: answers.projectCode || "RLD",
      placeholder: "RLD",
    });
  }
  if (key === "workstoreKind") {
    return p.select({
      message: "Where should this repo keep notes?",
      options: [
        { value: "inherit", label: "Use the global workstore" },
        { value: "repo", label: "In this repo (.bluesurf/)" },
      ],
      initialValue: answers.workstoreKind === "repo" ? "repo" : "inherit",
    });
  }
  if (key === "tracked") {
    return p.confirm({
      message: "Track .bluesurf/ in git?",
      initialValue: answers.tracked === true,
    });
  }
  throw new Error(`Unknown init question ${key}.`);
}
