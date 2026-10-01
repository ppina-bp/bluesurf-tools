---
name: bluesurf-move
description: Moves a Blue Surf (Surf) ticket to another board status, such as RLD-388 to Development (DONE). Always previews and asks before changing anything, because the team sees the move. Use when the user wants a ticket's status changed, in any wording: "move RLD-388 to dev done", "I finished 388", "mark 387 as blocked", "put RLD-400 in testing", "surf move 388 to done", or /bluesurf-move.
---

Repo: `~/Projects/bluesurf-tools`. Session is `.surf-cookies.json` there, loaded into headless Chromium.

**Expired session:** if a command fails with "session expired", sign in again yourself; don't just tell the user to. Run `npm run login` from the repo (allow up to 6 minutes). It opens a Chromium window and exits by itself once the user is signed in; no Enter needed. Tell the user to finish SSO in that window. When it prints `Signed in`, retry the original command once. If login exits non-zero (window closed or timed out), stop and tell the user.

## Move

1. Work out the ticket key and the target status. Loose names are fine (`dev done`, `testing in progress`, `val blocked`). "I finished X" usually means the DONE column of X's current stage; if that is unclear, ask.
2. **Preview:** `npm run move -- RLD-388 "dev done"` (no `--yes`). It prints `Would move RLD-388: <from> → <to>` and changes nothing. If it says the name is ambiguous or unknown, show the options it lists and ask. If it says the ticket is already there, tell the user and stop.
3. **Confirm:** ask with the harness question tool (`AskUserQuestion` in Claude Code, `AskQuestion` in Cursor), showing the exact from → to line. One question per ticket; the user can approve several in one form. Never skip this step, even if the user sounded sure.
4. **Move:** `npm run move -- RLD-388 "dev done" --yes`. Done when it prints `Moved RLD-388: <from> → <to>`. A "board refresh notice not sent" line is fine; the move still happened.

Never move a ticket the user did not name. Moving tickets is the only write this skill makes; it does not pull notes or touch the vault.
