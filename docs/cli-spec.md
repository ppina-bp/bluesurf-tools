# Bluesurf CLI — specification (v1)

Global command: **`bluesurf`** (`npm i -g @bluepeople/bluesurf`).

This document is the single source of truth for setup, init, workstore, configuration, skills invocation, and phased delivery. It supersedes scattered notes in README for end-user install once the CLI ships.

---

## 1. Goals

| Goal | Approach |
| --- | --- |
| Unopinionated storage | **Workstore** — any directory (Obsidian vault, plain folder, XDG per project, or repo-local) |
| One install path | Global npm package; session/state under XDG |
| Per implementation repo | `bluesurf init` → `AGENTS.md`, `.surf/project.toml`, project `.cursor/rules` |
| Agent skills | Call **`bluesurf`** on PATH only (not `npm run` from a clone) |
| Tweaks | TOML config: global defaults + per-repo overrides |
| Ticket complete | **AGENTS.md** = implementation gates; **config** = whether workstore folder is deleted |

---

## 2. Layout on disk

```text
~/.config/bluesurf/
  config.toml                 # machine defaults (bluesurf setup)

~/.local/share/bluesurf/
  session/                    # cookies, Playwright chromium profile
  workstore/<project_code>/   # when workstore.kind = "local"

<implementation-repo>/
  AGENTS.md
  .surf/project.toml          # repo overrides
  .cursor/rules/              # repo-specific rules (init)
  .bluesurf/                  # optional; when workstore.kind = "repo"
```

Package install (global):

```text
$(npm root -g)/@bluepeople/bluesurf/
  skills/                     # bundled Blue Surf skills (symlinked by setup)
  templates/
```

**Dev override:** `config.toml` → `[skills].source = "/path/to/bluesurf-tools"` relinks to clone instead of package tree.

---

## 3. Command surface

### 3.1 Lifecycle

| Command | Purpose |
| --- | --- |
| `bluesurf setup` | Interactive wizard: harnesses, Matt Pocock skills, Blue Surf skill links, rules, workstore, personalization defaults, login if no session |
| `bluesurf init` | Implementation repo: `AGENTS.md`, `.surf/project.toml`, `.cursor/rules`, optional repo workstore + `.gitignore` |
| `bluesurf doctor` | Config valid, `bluesurf` on PATH, workstore writable, symlinks, session present, Node version, duplicate Cursor rules warning |
| `bluesurf upgrade` | `npm update -g @bluepeople/bluesurf`, relink bundled skills, refresh managed rule sections (no Matt Pocock unless `--with-matt`) |
| `bluesurf config get <dot.key>` | Print merged value (optional cwd) for agents |
| `bluesurf --version` | CLI + bundled skills version |

### 3.2 Session & Surf client

| Command | Notes |
| --- | --- |
| `bluesurf login` | Headed SSO; writes session under `~/.local/share/bluesurf/session/` |
| `bluesurf ticket <CODE>` | Pull ticket into workstore; honors `--cwd` |
| `bluesurf ticket-done <CODE>` | After gates (skill); honors `ticket.done.delete_folder` |
| `bluesurf sprint` | Current sprint note |
| `bluesurf sprint-review [--sprint N]` | Previous or named sprint |
| `bluesurf mine [--json] [--all]` | List assigned tickets |
| `bluesurf move <CODE> <status> [--yes]` | Preview unless `--yes` (skill must preview first) |
| `bluesurf daily-report fetch\|plan\|apply <date> [--json] [--ticket CODE:hours]` | Daily report flow |

**`--cwd <path>`** (v1): all workstore-aware commands resolve `project.toml` from this directory (default: `process.cwd()`).

Flags (non-exhaustive):

- `--project <code>` — override `[surf].project_code` for one invocation
- `--json` — machine-readable output where supported

---

## 4. Workstore backends

| `kind` | Set where | Resolved root |
| --- | --- | --- |
| `path` | setup → global; override in project.toml | Absolute path user chose (Obsidian or any folder) |
| `local` | setup default; override per repo | `~/.local/share/bluesurf/workstore/<project_code>/` |
| `repo` | **`bluesurf init` only** | `<repo_root>/<workstore.root>` e.g. `.bluesurf/` |

**Precedence:** merge config for `cwd` (or `--cwd`):

1. `.surf/project.toml` `[workstore]` and other sections
2. `~/.config/bluesurf/config.toml`
3. Built-in defaults

**Safety (repo kind):** read/write/delete only under:

- `{root}/{layout.tickets}/**`
- `{root}/{layout.sprints}/**`

**Default layout:**

```toml
[workstore.layout]
tickets = "Tickets"
sprints = "Sprints"
```

Legacy Blue People paths (`Proyect/Tickets`) remain valid if set explicitly.

**Repo + git:** default `workstore.vcs.tracked = false` → init adds `.bluesurf/` to `.gitignore`. Set `tracked = true` to commit notes in-repo.

---

## 5. Configuration schema

Types and defaults. Keys omitted in `project.toml` inherit from global.

### 5.1 Meta & Surf

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `version` | int | `1` | Config schema version |
| `surf.origin` | string | `https://surf.bluepeople.com` | Surf base URL |
| `surf.project_code` | string | — | Default project small code (`RLD`, `PRY`, …) |

### 5.2 Workstore

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `workstore.kind` | enum | `path` | `path` \| `local` \| `repo` (repo only in project.toml) |
| `workstore.root` | string | — | Absolute path if `path`; relative to repo if `repo` |
| `workstore.layout.tickets` | string | `Tickets` | Relative dir under root |
| `workstore.layout.sprints` | string | `Sprints` | Relative dir under root |
| `workstore.vcs.tracked` | bool | `false` | Repo workstore: commit vs gitignore |

### 5.3 Harnesses & skills install (global)

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `harnesses.enabled` | string[] | `["cursor","codex","claude"]` | Last setup selection |
| `skills.matt_pocock` | bool | `true` | Run `npx skills add mattpocock/skills` on setup |
| `skills.source` | string? | — | Dev: path to skills repo for symlinks |

### 5.4 Ticket & pull

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `ticket.bugs_detected_tag` | string | `Bugs Detected` | Skip grill; implement from comments |
| `ticket.after_pull` | enum | `ask` | `ask` \| `grill` \| `implement` when not bugs-detected |
| `ticket.commit_subject_prefix` | bool | `true` | Skill expects `(CODE)` in commit subjects |
| `ticket.description` | enum | `html` | `html` \| `strip_html` \| `markdown` in `detail.md` |
| `ticket.done.delete_folder` | bool | `true` | `ticket-done` removes ticket dir when true |
| `pull.download_attachments` | bool | `true` | Download attachment bytes on pull |

### 5.5 Sprint, mine, move, daily report

| Key | Type | Default | Description |
| --- | --- | --- | --- |
| `sprint.sort` | enum | `priority` | `priority` \| `code` \| `status` |
| `mine.include_done` | bool | `false` | Default for `bluesurf mine` without `--all` |
| `move.require_preview` | bool | `true` | **Skill-only** in v1; CLI does not enforce |
| `daily_report.hours_cap` | number | `8` | Plan step trims to this total |

---

## 6. Example files (with values)

### 6.1 Global — `~/.config/bluesurf/config.toml`

Typical machine after `bluesurf setup` (Obsidian vault on disk, delete folders on done, ask after pull):

```toml
version = 1

[surf]
origin = "https://surf.bluepeople.com"
project_code = "RLD"

[workstore]
kind = "path"
root = "/Users/patopina/BluePeople"

[workstore.layout]
tickets = "Tickets"
sprints = "Sprints"

[harnesses]
enabled = ["cursor", "codex", "claude"]

[skills]
matt_pocock = true
# source = "/Users/patopina/Projects/bluesurf-tools"  # dev only

[ticket]
bugs_detected_tag = "Bugs Detected"
after_pull = "ask"
commit_subject_prefix = true
description = "html"

[ticket.done]
delete_folder = true

[pull]
download_attachments = true

[sprint]
sort = "priority"

[mine]
include_done = false

[move]
require_preview = true

[daily_report]
hours_cap = 8.0
```

**XDG per-project default** (no Obsidian path):

```toml
[workstore]
kind = "local"
# root unused; uses ~/.local/share/bluesurf/workstore/RLD/
```

### 6.2 Per-repo — `.surf/project.toml`

**Override-only init** (only keys that differ + required identity):

```toml
version = 1
project_code = "PRY"

# Keep ticket notes in repo; do not delete on done
[ticket.done]
delete_folder = false

[workstore]
kind = "repo"
root = ".bluesurf"

[workstore.vcs]
tracked = false
```

**Full override example** (client app + strip HTML + cap hours):

```toml
version = 1
project_code = "PRY"

[workstore]
kind = "path"
root = "/Users/patopina/BluePeople"

[ticket]
description = "strip_html"
after_pull = "grill"

[daily_report]
hours_cap = 7.5
```

### 6.3 Resolved workstore paths (examples)

| Scenario | `ticket-done` with delete | `detail.md` path |
| --- | --- | --- |
| Global `path` + layout `Tickets` | removes dir | `/BluePeople/Tickets/PRY-123/detail.md` |
| Global `local` + code `RLD` | removes dir | `~/.local/share/bluesurf/workstore/RLD/Tickets/RLD-100/detail.md` |
| Repo `.bluesurf` + `delete_folder = false` | no-op | `<repo>/.bluesurf/Tickets/PRY-123/detail.md` |

Validation artifacts (functional-test): `{tickets}/{CODE}/validation/` (skill path unchanged; workstore-relative).

---

## 7. `bluesurf setup` wizard (order)

1. Harnesses: Cursor / Codex / Claude (or all)
2. Workstore mode: **folder path** \| **local share** (`~/.local/share/bluesurf/workstore/<code>/`)
3. Subdirs: tickets / sprints (defaults `Tickets`, `Sprints`)
4. `surf.project_code` (default from example or user input)
5. Short personalization: `delete_folder`, `download_attachments`, `after_pull`
6. Optional advanced: remaining keys (or edit `config.toml` later)
7. `npm install` deps for package; Matt Pocock if enabled; symlink skills; install rules
8. `bluesurf login` if no session

Does **not** set `workstore.kind = "repo"` — that is **`bluesurf init`**.

---

## 8. `bluesurf init` wizard (order)

1. Confirm repo root (`git` preferred)
2. `project_code` (default from global)
3. Workstore: inherit global \| **in repo** (`.bluesurf/`)
4. If repo workstore: `.gitignore` `.bluesurf/` unless `tracked = true`
5. Overrides only: prompt if user wants different `delete_folder`, `description`, etc.
6. Write `AGENTS.md` from template (managed markers)
7. Write `.surf/project.toml` (override-only + `project_code` + repo workstore if any)
8. Write minimal `.cursor/rules/`

---

## 9. Ticket complete flow

```text
functional-test passed
        │
        ▼
AGENTS.md Ticket done — all gates true?
        │ no ──► stop (folder unchanged)
        ▼ yes
bluesurf ticket-done CODE [--cwd repo]
        │
        ├─ ticket.done.delete_folder = true  ──► remove Tickets/CODE/
        └─ ticket.done.delete_folder = false ──► exit 0, message: workstore kept
```

**AGENTS.md** still lists PR/CI/push gates. It does **not** need a row for “delete folder”; that is **config only**.

---

## 10. Skills → CLI (mandatory wording)

| Skill | Commands |
| --- | --- |
| bluesurf-ticket | `bluesurf ticket CODE`, `bluesurf login`, `bluesurf ticket-done CODE` |
| bluesurf-sprint | `bluesurf sprint` |
| bluesurf-sprint-review | `bluesurf sprint-review`, `bluesurf sprint-review --sprint N` |
| bluesurf-mine | `bluesurf mine --json`, `--all` if needed |
| bluesurf-move | preview without `--yes`, then `bluesurf move … --yes` |
| bluesurf-daily-report | `bluesurf daily-report fetch\|plan\|apply …` |
| functional-test | validation under workstore; session: `bluesurf login` |

**Session block (all skills):** on auth failure, run `bluesurf login` (up to ~6 min), retry once.

**CWD:** run workstore commands from implementation repo root or pass `--cwd <repo>`.

**Doctor:** users must have `bluesurf` on PATH (`bluesurf doctor` checks).

---

## 11. `bluesurf init` / `project.toml` policy (locked)

- Write **only** keys that differ from global, plus **always** `project_code`.
- Always write **repo workstore** section when user picks in-repo storage.
- Do not duplicate entire global config into every repo.

---

## 12. `ticket.description` (v1)

| Value | `detail.md` body |
| --- | --- |
| `html` | Surf HTML as returned |
| `strip_html` | Plain text (tags removed; structure flattened) |
| `markdown` | Converted HTML → markdown (best-effort) |

Default: `html`.

---

## 13. Phased delivery

### Phase 0 — Spec (this document)

- ADR: workstore replaces `OBSIDIAN_*` for end users
- Skill text and templates reference this spec

### Phase 1a — Config + workstore resolver

- `resolveConfig({ cwd })`, `resolveWorkstore({ cwd })`
- Replace `.env` reads in client scripts with resolver (dev `.env` optional for clone)

### Phase 1b — CLI core

- `setup`, `init`, `doctor`, `login`, `config get`
- Example `config.toml` / `project.toml` writers

### Phase 1c — Client subcommands

- `ticket`, `ticket-done` (with `delete_folder`), `sprint`, `sprint-review`, `mine`, `move`, `daily-report`
- Global `--cwd`
- Personalization keys wired in code

### Phase 1d — Skills & templates

- All skills use `bluesurf`; workstore-neutral copy
- `AGENTS.md.template` updated

### Phase 2 — Publish

- `@bluepeople/bluesurf` on npm; `bluesurf upgrade`
- Dev repo `npm run *` → thin wrappers calling same entrypoint

### Phase 3 — Decommission

- User docs: no clone required for agents
- Optional: archive env var names with warnings

---

## 14. Out of scope v1

- Cursor Marketplace as install path
- Surf API “mark ticket done” from CLI
- Archive folder instead of delete (v2: `ticket.done.mode`)
- CLI enforcement of `move.require_preview`
- Syncing config across machines
- MCP config inside TOML

---

## 15. v2 personalization backlog

| Key | Purpose |
| --- | --- |
| `ticket.done.mode` | `delete` \| `keep` \| `archive` |
| `workstore.layout.validation` | Rename validation subfolder |
| `session.login_timeout_seconds` | Login window |
| `pull.max_attachment_mb` | Size cap |
| `daily_report.apply_requires_tty` | Safety on apply |
| `client.signalr_refresh` | Board hub after move |

---

## 16. Migration from today’s clone workflow

| Today | After CLI |
| --- | --- |
| `npm run setup` | `bluesurf setup` |
| `npm run login` | `bluesurf login` |
| `npm run ticket -- CODE` | `bluesurf ticket CODE` |
| `OBSIDIAN_VAULT` in `.env` | `[workstore]` in `config.toml` |
| Session in repo | `~/.local/share/bluesurf/session/` |

---

*Last updated from planning session 2026-11-20. Locked choices: `@bluepeople/bluesurf`, `--cwd` on workstore commands, description `html|strip_html|markdown`, move preview skill-only, init project.toml override-only.*

## Implementation status (2026-11-20)

Phases 1–2 are implemented in this repo: `bin/bluesurf.mjs`, config/workstore resolution, unified commands, skills updated to call `bluesurf`. Legacy `npm run` scripts delegate to the same CLI. Global config: `~/.config/bluesurf/config.toml`. Session: `~/.local/share/bluesurf/session/`. Dev clone `.env` still loads when `BLUESURF_SKIP_LEGACY_ENV` is unset. **Platforms:** [platform.md](platform.md).