# Install skills and rules per harness

**Status:** Active (extended by CLI — see [cli-spec.md](../cli-spec.md)).

Setup is **`bluesurf setup`** (same behavior as the legacy `npm run setup` wrapper in this clone). It exists because the old checklist (hand-pasted Cursor rules, a full overwrite of `~/.codex/AGENTS.md`, and symlinks you typed yourself) was easy to do halfway. Setup asks which harnesses you want — Cursor, Codex, Claude Code, or any mix — and installs only those. A later run adds a harness you skipped and leaves the others alone.

Setup also writes **`~/.config/bluesurf/config.toml`** (workstore and personalization). Machine session lives under **`~/.local/share/bluesurf/session/`**. Implementation repos use **`bluesurf init`**.

Blue Surf skills are **symlinks** into the package (or `[skills].source` in config for dev). Targets include `~/.agents/skills` (router), `~/.cursor/skills`, `~/.codex/skills`, and `~/.claude/skills`. **`bluesurf upgrade`** refreshes links after `git pull`.

Matt Pocock’s skills come from `npx skills` for every selected harness. Do not install the Claude Code plugin `mattpocock-skills` — duplicate skills.

Cursor’s account-synced Settings rules cannot be written by a script. Machine-local files in `~/.cursor/rules` can. Codex and Claude Code share a managed section in `AGENTS.md` / `CLAUDE.md`; setup replaces only that section. A file that is still the old full copy of `rules/AGENTS.md` is replaced outright. Anything else stays, and setup warns about headings that appear twice.

Surf login runs when no session cookie file exists under the session dir. An expired session is refreshed by skills (`bluesurf login`), not by setup alone.