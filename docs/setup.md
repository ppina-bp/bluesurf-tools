# Setup

This is **Pato Piña / patopiña’s** agent setup, not a generic Surf or Blue People process. After a ticket is pulled, agents follow [Matt Pocock’s engineering skills](https://github.com/mattpocock/skills) (grill → spec → tickets → implement with TDD → review → **functional-test**) plus the Blue Surf skills in this repo.

Machine settings live in **`~/.config/bluesurf/config.toml`**. Implementation repos use **`bluesurf init`** → `AGENTS.md` + `.surf/project.toml`.

Docs: [cli-spec.md](cli-spec.md) · **[setup-windows.md](setup-windows.md)** (Windows) · [platform.md](platform.md) · [design.md](design.md).

**Windows:** use **[setup-windows.md](setup-windows.md)** first (Developer Mode, PATH, PowerShell, symlink troubleshooting). Steps below use Unix-style paths; on Windows replace `~/Projects/…` with `%USERPROFILE%\Projects\…`.

**Node:** Node 18+ runs this repo. The Matt Pocock installer (`npx skills …`) wants Node **22.20+** for `skills@latest`. On Node 20 or 21, setup pins **`skills@1.5.18`**. Upgrade Node when you can.

Open a **new chat** after setup so the harness reloads skills and rules.

## 1. Install the CLI

```bash
git clone https://github.com/ppina-bp/bluesurf-tools.git ~/Projects/bluesurf-tools
cd ~/Projects/bluesurf-tools
npm install
npm link
```

This puts **`bluesurf`** on your PATH from the clone. Later you can use `npm i -g @bluepeople/bluesurf` when the package is published; until then, `npm link` from the clone is the supported path.

Check:

```bash
bluesurf --version
bluesurf doctor
```

## 2. `bluesurf setup` (once per machine)

Interactive (TTY) or with harness flags:

```bash
bluesurf setup
bluesurf setup --all
bluesurf setup --cursor --claude
```

**Workstore** (first-time wizard):

1. **Folder on disk** — any path (Obsidian vault, `~/Notes`, etc.).
2. **Local per project** — `~/.local/share/bluesurf/workstore/<project_code>/` (default layout `Tickets/`, `Sprints/`).

Repo-local workstore (`.bluesurf/`) is **not** set here; use **`bluesurf init`** in each implementation repo.

Setup then:

1. Writes **`~/.config/bluesurf/config.toml`** and syncs a dev **`.env`** in this clone (legacy compatibility for contributors).
2. Runs `npm install` (Playwright Chromium).
3. Installs Matt Pocock skills globally (`npx skills add mattpocock/skills`, whole pack). **Do not** install the Claude Code plugin `mattpocock-skills` — duplicate skills.
4. Symlinks Blue Surf skills from this package into harnesses you picked and **`~/.agents/skills`**. Source path: package install; dev override: `[skills].source` in config.
5. Installs global rules:
   - **Cursor:** `~/.cursor/rules/*.mdc` — remove duplicate copies from Settings → User Rules if you pasted them before.
   - **Codex / Claude:** managed block in `~/.codex/AGENTS.md` / `~/.claude/CLAUDE.md`.
6. Runs **`bluesurf login`** when no session exists under `~/.local/share/bluesurf/session/`.

Re-run setup to refresh selected harnesses. It does not uninstall a harness you skip.

Non-interactive workstore (CI / script):

```bash
export OBSIDIAN_VAULT=/path/to/workstore   # or BLUESURF_WORKSTORE_ROOT
export BLUESURF_WORKSTORE_KIND=local       # optional
bluesurf setup --all
```

Do **not** run `/setup-matt-pocock-skills` in **this** repo — that skill is for implementation repos when you ask by name.

### After `git pull` in bluesurf-tools

```bash
cd ~/Projects/bluesurf-tools
git pull
bluesurf upgrade              # relink skills from package
npm run link-skills           # optional: refresh symlinks only
```

New Blue Surf skill folder? Re-run `bluesurf setup` for the harnesses you use (or `link-skills`).

## 3. Implementation repo: `bluesurf init`

From the app repo root:

```bash
cd ~/Projects/my-app
bluesurf init
```

Creates (when missing):

- **`AGENTS.md`** from [`templates/AGENTS.md.template`](../templates/AGENTS.md.template) — fill every `FILL:` (commands, Verify, functional testing, **Ticket done**).
- **`.surf/project.toml`** — `project_code`, optional overrides (e.g. `ticket.done.delete_folder = false`, `workstore.kind = "repo"` + `.bluesurf/`).
- **`.cursor/rules/bluesurf-project.mdc`** — short repo reminder.

Repo workstore default: **`.bluesurf/`** with **`.gitignore`** entry (notes stay local unless you set `workstore.vcs.tracked = true`).

Agents run ticket commands with **`--cwd`** pointing at this repo when workstore is defined in `project.toml`.

## 4. Surf session only

```bash
bluesurf login
```

Headed Chromium; saves cookies to `~/.local/share/bluesurf/session/surf-cookies.json`. Later commands are headless.

If your clone still has **`.surf-cookies.json`** at the repo root, the CLI prefers the XDG session when present; legacy cookies in the clone are used only when no XDG session exists yet.

When skills see “session expired”, they run **`bluesurf login`** and retry.

## 5. Verify

```bash
cd ~/Projects/bluesurf-tools && npm test
bluesurf doctor

test -f ~/.agents/skills/bluesurf-ticket/SKILL.md && echo "ticket skill ok"
test -f ~/.agents/skills/functional-test/SKILL.md && echo "functional-test skill ok"
test -f ~/.agents/skills/bluesurf-sprint/SKILL.md && echo "sprint skill ok"
test -f ~/.agents/skills/bluesurf-sprint-review/SKILL.md && echo "sprint-review skill ok"
test -f ~/.agents/skills/bluesurf-mine/SKILL.md && echo "mine skill ok"
test -f ~/.agents/skills/bluesurf-daily-report/SKILL.md && echo "daily-report skill ok"
test -f ~/.config/bluesurf/config.toml && echo "config ok"
```

New chat: `/bluesurf-sprint` or “pull PRY-XXX”.

### Sharing with teammates

- Hand off the **git repo** (clone), not a zip of someone’s tree. Keep **session**, **config**, and **`.env`** on each machine (gitignored in the clone).
- Everyone runs their **own** `bluesurf setup` and **`bluesurf login`**.
- Use **skills** in chat (`bluesurf-move` previews moves; blind `bluesurf move --yes` skips that).
- **Ticket done** in each repo’s **AGENTS.md** defines when agents may run **`bluesurf ticket-done`**. Folder deletion is **`ticket.done.delete_folder`** in TOML, not the table.
- Do not edit Matt Pocock skills locally. Surf orchestration stays in **bluesurf-ticket** and **functional-test**.
- **Bugs Detected** (or your `ticket.bugs_detected_tag`) skips grill; comments land in the pulled note.
- Attachments download when `pull.download_attachments` is true — only pull work you would open in Surf.

## Configuration cheat sheet

| Key | Meaning |
| --- | --- |
| `[workstore]` | `kind`, `root`, `layout.tickets` / `sprints` |
| `ticket.done.delete_folder` | `bluesurf ticket-done` removes ticket dir (default `true`) |
| `pull.download_attachments` | Pull downloads files (default `true`) |
| `ticket.description` | `html` \| `strip_html` \| `markdown` |
| `daily_report.hours_cap` | Plan trim target (default `8`) |
| `sprint.sort` | `priority` \| `code` \| `status` |

Read merged values from an implementation repo:

```bash
bluesurf config get ticket.done.delete_folder --cwd ~/Projects/my-app
```

Edit global defaults: `~/.config/bluesurf/config.toml`. Per-repo overrides: `.surf/project.toml` only for keys that differ (+ `project_code`).