# Blue Surf tools

Local **`bluesurf`** CLI, Surf session replay, and harness skills/rules for the engineering workflow around Blue Surf tickets.

See also: [docs/cli-spec.md](docs/cli-spec.md), [docs/design.md](docs/design.md).

## Language

**Harness**:
Cursor, Codex, or Claude Code. Each loads skills and rules from its own configuration.
_Avoid_: agent, IDE, tool

**bluesurf CLI**:
The `bluesurf` command on PATH (`@bluepeople/bluesurf`). Agents invoke `bluesurf ticket`, `login`, etc. — not `npm run` from a clone.
_Avoid_: npm scripts (for agents)

**Workstore**:
Directory tree where ticket and sprint notes are written (`Tickets/<code>/`, `Sprints/` by default). Can be an Obsidian vault, any folder, XDG local storage, or `.bluesurf/` in a repo. Resolved from `~/.config/bluesurf/config.toml` and `.surf/project.toml`.
_Avoid_: vault (unless user means Obsidian), OBSIDIAN_VAULT

**Blue Surf skills**:
Skills in this package that call the CLI: ticket, sprint, sprint-review, move, mine, daily-report, plus **functional-test** (orchestrated by **bluesurf-ticket**).

**Implementation AGENTS template**:
`templates/AGENTS.md.template` — copied by **`bluesurf init`** (or by hand) into each app repo as `AGENTS.md`: Verify, functional testing, branches, **Ticket done** gates.

**Matt Pocock skills**:
External skills from mattpocock/skills (immutable). Router in global rules sends work there; **bluesurf-ticket** orchestrates Surf-only steps after **implement**.

**Managed section**:
Marked block in `~/.codex/AGENTS.md` / `~/.claude/CLAUDE.md` that **`bluesurf setup`** replaces on refresh.

**Setup**:
**`bluesurf setup`** — machine: config, harnesses, Matt Pocock install, skill symlinks, rules, login if needed. **`bluesurf init`** — one implementation repo.
_Avoid_: bootstrap (use setup/init)