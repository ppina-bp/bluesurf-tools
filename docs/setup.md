# Setup

This is **Pato Piña / patopiña’s** agent setup, not a generic Surf or Blue People process. After a ticket is pulled, agents follow [Matt Pocock’s engineering skills](https://github.com/mattpocock/skills) (grill → spec → tickets → implement with TDD → review) plus the Blue Surf skills in this repo.

Do this on a new machine, or when the home-dir skills/rules are missing. Open a **new chat** after you finish so Cursor and Codex reload rules.

## 1. Clone this repo and log in to Surf

```bash
git clone https://github.com/ppina-bp/bluesurf-tools.git ~/Projects/bluesurf-tools
cd ~/Projects/bluesurf-tools
cp .env.example .env
```

Edit `.env`:

- `BLUESURF_ORIGIN` — `https://surf.bluepeople.com`
- `BLUESURF_PROJECT` — `RLD`
- `OBSIDIAN_VAULT` — path to the BluePeople vault
- `OBSIDIAN_TICKETS_DIR` / `OBSIDIAN_SPRINTS_DIR` — `RLand/Tickets` and `RLand/Sprints`

Then:

```bash
npm install
npm run login
```

Complete SSO in the Chromium window. It saves the session to `.surf-cookies.json` (gitignored, mode 600) and closes by itself once you are signed in; later commands run headless. Never `POST /api/login` from this repo.

### Sharing with teammates

- Hand off the **git repo** (clone), not a zip or copy of someone’s working tree. Local-only files — `.surf-cookies.json`, `.chrome-profile/`, `.env`, and `.scratch/` — are gitignored and must stay on each person’s machine.
- Everyone uses their **own** SSO via `npm run login`. Sessions are not shared.
- Use the **skills** (`bluesurf-move`, `bluesurf-ticket`, …) in agent chats. They enforce preview/confirm for board moves; running `npm run move … --yes` directly skips that step.
- Tickets tagged **Bugs Detected** tell the agent to implement from Surf **comments** without a grill step. Description and comments are written into Obsidian as-is (HTML included).
- Pulling a ticket downloads **attachments** into your vault. Only pull work items you would open in Surf anyway.

## 2. Install Matt Pocock’s skills

The skill router reads `~/.agents/skills/<name>/SKILL.md`. Install the pack **into your home directory**, not into this repo:

```bash
npx skills@latest add mattpocock/skills
```

When the installer asks which agents, pick every one you use (Cursor, Claude Code, Codex). Confirm:

```bash
ls ~/.agents/skills/grill-with-docs/SKILL.md
```

If that file is missing but the skill landed under `~/.cursor/skills` or `~/.claude/skills`, symlink it into `~/.agents/skills` so the router can find it.

Do **not** run `/setup-matt-pocock-skills` here. That skill is per implementation repo, and only when you name that repo and ask.

## 3. Install the Blue Surf skills

These skills live in this repo. Point the agent skill dirs at them:

```bash
REPO="$HOME/Projects/bluesurf-tools"
mkdir -p ~/.agents/skills ~/.claude/skills ~/.cursor/skills

for name in bluesurf-ticket bluesurf-sprint bluesurf-move bluesurf-mine; do
  ln -sfn "$REPO/skills/$name" "$HOME/.agents/skills/$name"
  ln -sfn "$REPO/skills/$name" "$HOME/.claude/skills/$name"
  ln -sfn "$REPO/skills/$name" "$HOME/.cursor/skills/$name"
done

ls -l ~/.agents/skills/bluesurf-* ~/.claude/skills/bluesurf-* ~/.cursor/skills/bluesurf-*
```

Each listing should point at `~/Projects/bluesurf-tools/skills/…`.

## 4. Install the Cursor user rules

The files in [`rules/`](../rules/) are the Cursor user rules (global — they apply in every repo, not only this one).

| File | Cursor rule title |
| --- | --- |
| [`rules/no-push-until-i-say-so.md`](../rules/no-push-until-i-say-so.md) | No push until I say so |
| [`rules/ask-questions-via-the-harness.md`](../rules/ask-questions-via-the-harness.md) | Ask questions via the harness |
| [`rules/matt-pocock-skill-router.md`](../rules/matt-pocock-skill-router.md) | Matt Pocock skill router |

**In Cursor:** Settings → Rules → User Rules. For each file except `rules/AGENTS.md`:

1. Create a user rule.
2. Title = the `title` in the file’s frontmatter.
3. Body = everything below the frontmatter.

Skip a title that already exists; update that rule’s body instead of adding a duplicate.

Or in a Cursor chat: “Add each file in `~/Projects/bluesurf-tools/rules/*.md` as a user rule, except `AGENTS.md`.”

## 5. Install the same rules for Codex

```bash
mkdir -p ~/.codex
cp ~/Projects/bluesurf-tools/rules/AGENTS.md ~/.codex/AGENTS.md
```

That overwrites `~/.codex/AGENTS.md`. If you already have other sections there, merge by hand instead of copying.

## Claude Code and Linux notes

- **Claude Code** reads `~/.claude/skills/`, which step 3 already links. The Blue Surf skills work without the Cursor rules or the Matt Pocock pack; skip steps 2, 4, and 5 if you only want the Surf commands. Start a new session after linking so the skills load.
- **Vault path:** set `OBSIDIAN_VAULT` in `.env` to your Obsidian vault root (see the placeholder in `.env.example`). On Linux, e.g. `~/Documents/BluePeople`; on macOS, often an iCloud Obsidian folder.

## 6. Check it

```bash
# Surf client
cd ~/Projects/bluesurf-tools && npm test

# Skills the router expects
test -f ~/.agents/skills/grill-with-docs/SKILL.md && echo "mattpocock ok"
test -f ~/.agents/skills/bluesurf-ticket/SKILL.md && echo "ticket skill ok"
test -f ~/.agents/skills/bluesurf-sprint/SKILL.md && echo "sprint skill ok"
test -f ~/.agents/skills/bluesurf-mine/SKILL.md && echo "mine skill ok"

# Codex rules
test -f ~/.codex/AGENTS.md && echo "codex rules ok"
```

Then a **new** Cursor chat: `/bluesurf-sprint` or “pull RLD-336”. If a command says the session expired, run `npm run login` again.
