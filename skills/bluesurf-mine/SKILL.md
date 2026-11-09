---
name: bluesurf-mine
description: Lists the Blue Surf (Surf) tickets assigned to the user across every sprint, newest sprint first. Read-only; writes nothing to the vault. This is the default for any question about the user's Surf tickets, in any wording: "surf my tickets", "my tickets", "what's on my plate", "what's assigned to me", "anything blocked?", "what's still open", or /bluesurf-mine.
---

Repo: `~/Projects/bluesurf-tools`. Session is `.surf-cookies.json` there, loaded into headless Chromium.

**Expired session:** if a command fails with "session expired", sign in again yourself; don't just tell the user to. Run `npm run login` from the repo (allow up to 6 minutes). It opens a Chromium window and exits by itself once the user is signed in; no Enter needed. Tell the user to finish SSO in that window. When it prints `Signed in`, retry the original command once. If login exits non-zero (window closed or timed out), stop and tell the user.

1. From the repo: `npm run mine -- --json` (add `--all` to include finished tickets).
2. Parse the JSON: an array of `{ sprint, items[] }`, newest sprint first, `No sprint` last. Each item has `code`, `title`, `status`, `priority`, `estimatedHours`, `type`, `tags`, `sprint`.
3. Answer the user from that list. Without `--all`, everything listed is open. Only `Validation (DONE)` is finished. Stage columns such as `Analysis (DONE)`, `Development (DONE)` and `Testing (DONE)` are still open work, so don't call them done. A story in `Analysis (DONE)` is ready to develop.

Do not pull or write a ticket note unless they ask; that is `bluesurf-ticket`.
