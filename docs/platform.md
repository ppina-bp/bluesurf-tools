# Platforms (Windows, macOS, Linux)

## Summary

| Area | macOS | Linux | Windows |
| --- | --- | --- | --- |
| **CLI (`bluesurf`)** | Yes | Yes | Yes |
| **Playwright / SSO login** | Yes | Yes | Yes |
| **Config & session paths** | `~/.config`, `~/.local/share` | Same | Same under `%USERPROFILE%` (not `%APPDATA%`, but valid) |
| **Setup (`npm`/`npx` via `spawnSpec`)** | Yes | Yes | Yes (`npm.cmd` / `npx.cmd`) |
| **Skill install (symlinks)** | Yes | Yes | **Conditional** — see below |
| **`bluesurf doctor` PATH check** | Yes | Yes | Yes (`where bluesurf`) |

**Verdict:** **macOS and Linux** are the supported, day-to-day targets. **Windows** works for the CLI, Surf session, and client commands if Node, Playwright Chromium, and harnesses are installed — but **skill symlinks** often need extra setup.

## Windows: symlinks

`bluesurf setup` links each skill directory into `~/.cursor/skills`, `~/.agents/skills`, etc. On Windows, `fs.symlink` to a directory typically requires:

- **Developer Mode** (Settings → For developers), or  
- An elevated (Administrator) shell, or  
- **Directory junctions** (not implemented today — would be a future improvement)

Without that, setup may fail with “already exists” / permission errors, or create unexpected link types. **Workaround:** enable Developer Mode, re-run `bluesurf setup`, or use **WSL2** and install there (Linux behavior).

## Windows: paths

- Config: `%USERPROFILE%\.config\bluesurf\config.toml`
- Session: `%USERPROFILE%\.local\share\bluesurf\session\`
- Use forward slashes or quoted paths in TOML; backslashes in `workstore.root` are fine when escaped or using `/`.

## All platforms

- **Node** 18+; **22.20+** recommended for `skills@latest` during setup.
- **Harnesses** (Cursor, Codex, Claude Code) are separate installs; this repo does not bundle them.
- Agents expect **`bluesurf` on PATH** (`npm link` from clone, or global install when published).

See [setup.md](setup.md) for install steps. **Windows install guide:** [setup-windows.md](setup-windows.md).