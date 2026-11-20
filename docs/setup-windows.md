# Setup on Windows

Windows install for **`bluesurf`**. Shared steps (harnesses, workstore, init, config keys) are in **[setup.md](setup.md)**. Platform comparison: **[platform.md](platform.md)**.

## Before you start

| Requirement | Notes |
| --- | --- |
| **Node.js** | 18+ to run; **22.20+** recommended so `bluesurf setup` can use `skills@latest` for Matt Pocock skills |
| **Git** | Clone this repo |
| **Terminal** | PowerShell or Windows Terminal (recommended) |
| **Developer Mode** | **Strongly recommended** — see [Enable symlink support](#enable-symlink-support) |
| **Harness** | Cursor, Codex, and/or Claude Code installed separately |

## 1. Enable symlink support

`bluesurf setup` links skill folders into `%USERPROFILE%\.cursor\skills`, `%USERPROFILE%\.agents\skills`, and similar paths. On Windows, directory symlinks usually need one of:

1. **Developer Mode** (preferred)  
   - **Settings** → **Privacy & security** → **For developers** → **Developer Mode** → On  
   - Close and reopen your terminal, then continue below.

2. **Administrator terminal**  
   - Right‑click Terminal / PowerShell → **Run as administrator**, then run setup in that window.

3. **WSL2**  
   - Install and use the Linux path in [setup.md](setup.md) inside WSL (Ubuntu). Same repo clone under `~/Projects/…`.

If setup fails with permission errors or “not a symlink”, fix symlinks first, then re-run:

```powershell
cd $env:USERPROFILE\Projects\bluesurf-tools
bluesurf setup --all
```

## 2. Clone and install the CLI

```powershell
mkdir $env:USERPROFILE\Projects -ErrorAction SilentlyContinue
git clone https://github.com/ppina-bp/bluesurf-tools.git $env:USERPROFILE\Projects\bluesurf-tools
cd $env:USERPROFILE\Projects\bluesurf-tools
npm install
npm link
```

`npm link` registers `bluesurf` globally for your user. Verify:

```powershell
bluesurf --version
bluesurf doctor
```

If `bluesurf` is not found, ensure npm’s global bin is on **PATH** (common with Node from [nodejs.org](https://nodejs.org)):

```powershell
npm config get prefix
# Add that path and \node_modules\.bin to your user PATH if needed
```

Playwright Chromium installs on first `npm install` (`postinstall`). If login fails, run once from the repo:

```powershell
npx playwright install chromium
```

## 3. Run setup

Interactive:

```powershell
bluesurf setup
```

Or skip harness menu:

```powershell
bluesurf setup --all
bluesurf setup --cursor
```

**Workstore:** choose a folder on disk (Obsidian vault, OneDrive path, etc.) or local storage under `%USERPROFILE%\.local\share\bluesurf\workstore\<project_code>\`.

Non-interactive example (set paths **before** setup):

```powershell
$env:OBSIDIAN_VAULT = "D:/Notes/BluePeople"
$env:BLUESURF_WORKSTORE_KIND = "path"
bluesurf setup --all
```

## 4. Config and session locations

| Item | Path |
| --- | --- |
| Global config | `%USERPROFILE%\.config\bluesurf\config.toml` |
| Session (cookies, Chromium profile) | `%USERPROFILE%\.local\share\bluesurf\session\` |

Example `config.toml` fragment (use `/` in paths to avoid escaping):

```toml
[workstore]
kind = "path"
root = "D:/Notes/BluePeople"

[workstore.layout]
tickets = "Tickets"
sprints = "Sprints"
```

Edit with Notepad or your editor. Agents read merged config; check a value with:

```powershell
bluesurf config get ticket.done.delete_folder
```

## 5. Sign in to Surf

```powershell
bluesurf login
```

Complete SSO in the Chromium window. Session is saved under `%USERPROFILE%\.local\share\bluesurf\session\surf-cookies.json`. Later commands run headless.

## 6. Implementation repo

```powershell
cd C:\path\to\your-app
bluesurf init
```

Fill **AGENTS.md** placeholders. Per-repo overrides: `.surf\project.toml`.

## 7. Verify

```powershell
cd $env:USERPROFILE\Projects\bluesurf-tools
npm test
bluesurf doctor

Test-Path "$env:USERPROFILE\.agents\skills\bluesurf-ticket\SKILL.md"
Test-Path "$env:USERPROFILE\.config\bluesurf\config.toml"
```

Open a **new chat** in Cursor (or your harness) and try `/bluesurf-sprint` or “pull PRY-XXX”.

## Troubleshooting

| Symptom | What to try |
| --- | --- |
| `bluesurf` not recognized | Fix npm global PATH; re-run `npm link` from the clone |
| Setup fails on skill links | Turn on **Developer Mode**, or run terminal as Admin, or use **WSL2** |
| `spawn npm ENOENT` | Use a current Node LTS; setup already routes through `cmd` for `npm.cmd` — don’t run ancient Node installs |
| Login window closes too soon | Re-run `bluesurf login`; finish SSO within 5 minutes |
| Workstore path errors in TOML | Prefer `D:/path` not `D:\path`; quote paths with spaces |
| Doctor warns “not on PATH” | `where bluesurf` in PowerShell should list the shim |

## WSL2 (optional)

If Windows symlink issues persist, clone in WSL and follow **[setup.md](setup.md)** there. Run `bluesurf` from WSL; point `workstore.root` at a Linux path or at `/mnt/c/...` if you need files on the Windows filesystem.

---

Next: [setup.md](setup.md) (full flow) · [cli-spec.md](cli-spec.md) · [README.md](../README.md)