# Prompt flow for setup and init

**Status:** Accepted

`bluesurf setup` and `bluesurf init` are the human wizards. Agents call the other commands with flags and `--json`, and a prompt on those commands would hang the agent. Both wizards use `@clack/prompts`, the same prompt flow as `npx skills`: arrow-key select, multiselect, confirm, and spinners in the normal scrollback. A full-screen terminal app was rejected. Putting that prompt flow on `ticket`, `mine`, `move`, `sprint`, or `daily-report` was rejected for the same reason.

Every wizard answer has a flag, so a provided answer skips its prompt even in a terminal. Resolution order is the flag for this run, then the process environment (`OBSIDIAN_VAULT`, `BLUESURF_WORKSTORE_ROOT`, `BLUESURF_WORKSTORE_KIND`), then the existing config file. The clone’s `.env` is still written for the old scripts and does not answer the wizard. A missing required answer with no terminal exits and names the flag. Contradictory flags exit before any prompt or write.

A later setup loads `config.toml`, pre-fills the prompts, and writes a merge so keys the wizard did not ask stay put. Harness flags add to the saved list. The multiselect is the only way to remove a harness, and removal deletes that harness’s own Blue Surf skill symlinks and rules. Shared `~/.agents/skills` links and Matt Pocock skills stay. `npx skills` is still invoked with `-y` so it does not open a second wizard.

Esc or Ctrl-C during the prompts writes nothing. After the last answer, a missing workstore root is created (the chosen folder, the local share directory, or `.bluesurf/` on init). Failure to create it leaves config unwritten. Init rewrites only `.surf/project.toml` on a later run. The `.gitignore` line `.bluesurf/` follows the tracked answer. Other lines stay, and the folder is not deleted when the repo goes back to the global workstore.

## Considered options

- Numbered readline menus, which setup and init used.
- A full-screen app for day-to-day Surf work, separate from the agent commands.
- The same prompts on agent commands whenever a terminal was missing a required argument.
- Rebuilding `config.toml` from built-in defaults on every setup.
- Leaving symlinks in place when a harness is cleared, so “remove” only changed the saved list.

## Consequences

- `@clack/prompts` is a dependency of the wizards. Tests talk to the answer-resolution and apply functions, not to keystrokes.
- Scripts that set `OBSIDIAN_VAULT` in the environment skip the workstore prompt. The same variable inside the clone `.env` does not.
- A cleared harness can still load Blue Surf skills from `~/.agents/skills`.
- An install failure after a successful wizard leaves the new config on disk.
