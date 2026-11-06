---
name: bluesurf-daily-report
description: >-
  Saves hours on the Blue Surf daily report without confirming. Use when the
  user asks to capture, log, or report hours, or says daily report. Never use
  Save & Confirm.
---

Repo: `~/Projects/bluesurf-tools`. Session is `.surf-cookies.json` there, loaded into headless Chromium.

**Expired session:** if a command fails with "session expired", sign in again yourself; don't just tell the user to. Run `npm run login` from the repo (allow up to 6 minutes). It opens a Chromium window and exits by itself once the user is signed in; no Enter needed. Tell the user to finish SSO in that window. When it prints `Signed in`, retry once. If login exits non-zero (window closed or timed out), stop and tell the user.

## Save, do not confirm

Default the date when they say "ayer" or "yesterday" (compute `YYYY-MM-DD` before calling the CLI). The user confirms in the Surf UI; you only draft-save.

Never run `apply` on a confirmed day (`status` 2). `apply` refuses automatically.

## Commands

From the repo, use **`npm run daily-report`** only — do not call Surf HTTP yourself.

1. `npm run daily-report -- fetch YYYY-MM-DD --json` — report, calendar, efforts index, categories, projects.
2. `npm run daily-report -- plan YYYY-MM-DD --json` — optional repeat `--ticket RLD-123:2.5` for ticket hours when the efforts API is empty.
3. When the plan looks right: `npm run daily-report -- apply YYYY-MM-DD` with the same `--ticket` flags if any.

Read `warnings` in plan/apply JSON. Tell the user activities, hours, and that confirm is still theirs at `https://surf.bluepeople.com/dailyReport/YYYY-MM-DD`.

Do not invent tickets or meetings; use fetch output and explicit `--ticket` overrides only.
