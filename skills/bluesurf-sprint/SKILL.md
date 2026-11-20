---
name: bluesurf-sprint
description: Writes or rewrites the current-sprint note (pending and done tables of the user's assigned Surf tickets) in the workstore under Sprints/Sprint N.md via bluesurf sprint. Use when the user wants their sprint captured, written, or refreshed, in any wording: "surf my sprint", "sprint note", "snapshot the sprint", or /bluesurf-sprint. To list tickets without writing a note, use bluesurf-mine. For the previous sprint, use bluesurf-sprint-review.
---

**CLI:** `bluesurf` on PATH. Session: `bluesurf login`.

**Expired session:** if a command fails with "session expired", sign in again yourself; don't just tell the user to. Run `bluesurf login` from the CLI (allow up to 6 minutes). It opens a Chromium window and exits by itself once the user is signed in; no Enter needed. Tell the user to finish SSO in that window. When it prints `Signed in`, retry the original command once. If login exits non-zero (window closed or timed out), stop and tell the user.

1. Use `bluesurf sprint`.
2. Done when `Sprints/Sprint N.md` exists under the workstore with H1 `# Sprint N` (current sprint only — no Review suffix), **Pending Tickets** and **Done Tickets** tables. If that sprint was already captured, the same file is rewritten.

Stop after the note is written. Pull a single ticket only if they ask.
