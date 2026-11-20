export const CONFIG_VERSION = 1;

export function defaultConfig() {
  return {
    version: CONFIG_VERSION,
    surf: {
      origin: "https://surf.bluepeople.com",
      project_code: "RLD",
    },
    workstore: {
      kind: "path",
      root: "",
      layout: {
        tickets: "Tickets",
        sprints: "Sprints",
      },
      vcs: {
        tracked: false,
      },
    },
    harnesses: {
      enabled: ["cursor", "codex", "claude"],
    },
    skills: {
      matt_pocock: true,
      source: "",
    },
    ticket: {
      bugs_detected_tag: "Bugs Detected",
      after_pull: "ask",
      commit_subject_prefix: true,
      description: "html",
      done: {
        delete_folder: true,
      },
    },
    pull: {
      download_attachments: true,
    },
    sprint: {
      sort: "priority",
    },
    mine: {
      include_done: false,
    },
    move: {
      require_preview: true,
    },
    daily_report: {
      hours_cap: 8,
    },
  };
}