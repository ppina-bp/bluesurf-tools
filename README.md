# @bluepeople/bluesurf

Local Blue Surf client, **`bluesurf` CLI**, and agent skills (Cursor, Codex, Claude Code). Commands replay **your** SSO session in a dedicated Chromium profile. There is no public API and no password handling.

This workflow is **opinionated to me (Pato Piña / patopiña)**. After a ticket is pulled, agents follow [Matt Pocock’s engineering skills](https://github.com/mattpocock/skills) — grill → spec → tickets → implement with TDD → review → functional-test — plus the Blue Surf skills in [`skills/`](skills/). That routing is mine; it is not a generic Surf or Blue People process.

Agents call **`bluesurf` on PATH** (skills do not use `npm run` from a clone). Harnesses load rules from [`rules/`](rules/) and skills from `~/.agents/skills` after setup. Use a **new chat** after install. Expired session: **`bluesurf login`**.

**Implementation repos:** `bluesurf init` (or copy [`templates/AGENTS.md.template`](templates/AGENTS.md.template)) → `AGENTS.md` + `.surf/project.toml`. Complements `setup-matt-pocock-skills` in that repo; does not replace it.

Docs: [docs/setup.md](docs/setup.md) · **[docs/setup-windows.md](docs/setup-windows.md)** (Windows) · [docs/cli-spec.md](docs/cli-spec.md) · [docs/platform.md](docs/platform.md) · [docs/design.md](docs/design.md)

## Quick start

```bash
git clone https://github.com/ppina-bp/bluesurf-tools.git ~/Projects/bluesurf-tools
cd ~/Projects/bluesurf-tools
npm install
npm link                    # installs bluesurf on PATH from this clone
bluesurf setup --all        # harnesses, workstore, skills, rules, login if needed
bluesurf doctor
```

On **Windows**, follow **[docs/setup-windows.md](docs/setup-windows.md)** (Developer Mode / symlinks) instead of the bash block below.

Open a **new chat** in your harness. In each app repo: **`bluesurf init`**.

## Workstore (where notes live)

Ticket and sprint notes go in a **workstore** — any folder you choose (Obsidian vault, iCloud/Dropbox path, `~/.local/share/bluesurf/workstore/<code>/`, or `.bluesurf/` inside a repo). Defaults: `Tickets/<CODE>/` and `Sprints/`.

| Config | Path |
| --- | --- |
| Machine defaults | `~/.config/bluesurf/config.toml` (`bluesurf setup`) |
| Per repo | `.surf/project.toml` (`bluesurf init`) |
| Session (cookies + Chromium profile) | `~/.local/share/bluesurf/session/` |

Legacy dev clone: repo `.env` and `.surf-cookies.json` still work until you rely on config only. See [docs/cli-spec.md](docs/cli-spec.md).

## `/bluesurf-ticket`

Pull one Surf work item into the workstore, then stop. **Bugs Detected** → implement from comments; otherwise grill vs implement.

**Say:** `/bluesurf-ticket PRY-XXX`, or “pull PRY-XXX”.

**Does:**

1. Reuses the saved session (headless Chromium).
2. Writes `Tickets/PRY-XXX/detail.md` (metadata, description per config, attachments when enabled).
3. Downloads files into `Tickets/PRY-XXX/attachments/` when `pull.download_attachments` is true.
4. Stops; routing per tags and config (`ticket.after_pull`, `ticket.bugs_detected_tag`).

**Work ticket:** grill → **implement** → **functional-test** (`Tickets/PRY-XXX/validation/`) → **complete** when **AGENTS.md** **Ticket done** gates are true.

**Complete:** `bluesurf ticket-done PRY-XXX` (use `--cwd <impl-repo>` when workstore comes from that repo’s `project.toml`). **AGENTS.md** lists implementation gates; whether the workstore folder is **deleted** is config: `ticket.done.delete_folder` (`bluesurf config get ticket.done.delete_folder`).

```bash
bluesurf ticket PRY-XXX
bluesurf ticket-done PRY-XXX
```

## `/bluesurf-sprint`

Snapshot your assigned tickets on the **current** sprint into the workstore (`Sprints/Sprint N.md`).

```bash
bluesurf sprint
bluesurf sprint --project RLD --cwd ~/path/to/repo
```

Pending / done tables, priority sort (configurable). Reported hours from `totalExecuted`.

## `/bluesurf-sprint-review`

Previous sprint (or explicit number): `bluesurf sprint-review` or `bluesurf sprint-review --sprint 13`.

## `/bluesurf-move`

Preview, then move with `--yes` (skill should preview first).

```bash
bluesurf move RLD-388 "dev done"
bluesurf move RLD-388 "dev done" --yes
```

## `/bluesurf-mine`

List assigned tickets (`--json`, `--all` for DONE).

```bash
bluesurf mine --json
```

## `/bluesurf-daily-report`

**Say:** `/bluesurf-daily-report`, “capture hours”, “daily report”, or “report time for yesterday”.

`fetch` · `plan` · `apply` (draft **Save** only — you confirm in Surf). Hours cap from config (`daily_report.hours_cap`, default 8).

```bash
bluesurf daily-report fetch 2026-11-05 --json
bluesurf daily-report plan 2026-11-05 --ticket RLD-100:2 --json
bluesurf daily-report apply 2026-11-05 --ticket RLD-100:2
```

## CLI reference

| Command | Purpose |
| --- | --- |
| `bluesurf setup` | Wizard: workstore, harnesses, Matt Pocock skills, Blue Surf symlinks, rules, login if needed |
| `bluesurf init` | Implementation repo: `AGENTS.md`, `.surf/project.toml`, `.cursor/rules` |
| `bluesurf login` | SSO in a window; session under `~/.local/share/bluesurf/session/` |
| `bluesurf doctor` | PATH, config, workstore, session, Node version |
| `bluesurf upgrade` | Relink bundled skills (+ optional `--with-matt`) |
| `bluesurf config get <key>` | Merged config value (e.g. `ticket.done.delete_folder`) |
| `bluesurf ticket`, `ticket-done`, `sprint`, `sprint-review`, `mine`, `move`, `daily-report` | Surf client (see `--cwd`, `--project`, `--json`) |
| `npm run …` | Thin wrappers around the same CLI (handy in this clone) |
| `npm test` | Unit tests |

Full spec: [docs/cli-spec.md](docs/cli-spec.md).

## Safety

- Do not commit session files, `.env`, `.chrome-profile/`, or `.scratch/`
- Share via **git clone**; each person runs **`bluesurf setup`** and **`bluesurf login`**
- `BLUESURF_HEADED=1` shows the browser for debugging
- Never `POST /api/login` from this code
- Prefer **bluesurf-move** in chat over raw `bluesurf move … --yes` without preview
- Push only when you explicitly ask; **Ticket done** in the implementation **AGENTS.md** is the gate list

### For colleagues

Clone → `npm install` → `npm link` (or `npm i -g` when published) → **`bluesurf setup`**. Tune behavior in `~/.config/bluesurf/config.toml`. Per repo: **`bluesurf init`** and fill **AGENTS.md**.

After `git pull` here: `bluesurf upgrade` or re-link skills (`npm run link-skills`). New skill directory? Re-run setup for your harnesses.