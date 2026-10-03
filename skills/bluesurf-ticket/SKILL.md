---
name: bluesurf-ticket
description: Pulls one Blue Surf (Surf) work item such as RLD-388 into the Obsidian vault (detail note plus attachments), then stops and asks grill vs implement. Use when the user wants a specific ticket brought down or worked on, in any wording: "surf RLD-388", "pull RLD-388", "grab ticket 388 from Surf", "let's work on RLD-388", or /bluesurf-ticket. When the pulled note is tagged Bugs Detected, the comments are regressions to fix: follow diagnosing-bugs and implement, and do not recommend grill. The complete branch ("the ticket is complete", "commit and push") applies only to a ticket pulled with this skill earlier in the same conversation; otherwise "commit and push" is ordinary git work, not this skill.
---

Repo: `~/Projects/bluesurf-tools`. Session is `.surf-cookies.json` there, loaded into headless Chromium.

**Expired session:** if a command fails with "session expired", sign in again yourself; don't just tell the user to. Run `npm run login` from the repo (allow up to 6 minutes). It opens a Chromium window and exits by itself once the user is signed in; no Enter needed. Tell the user to finish SSO in that window. When it prints `Signed in`, retry the original command once. If login exits non-zero (window closed or timed out), stop and tell the user.

## Pull

1. Take the ticket key from the user (`RLD-336`).
2. From the repo: `npm run ticket -- RLD-336`.
3. Done when `RLand/Tickets/RLD-336/detail.md` exists.

Then **stop**. Read the note's tags.

- If the tags include `Bugs Detected`, the `## Comments` section is the regression work. Follow `diagnosing-bugs`, then `implement` with `tdd`, for those comments. Do not ask grill vs implement.
- Otherwise ask grill vs implement with the harness question tool (`AskQuestion` in Cursor, `AskUserQuestion` in Claude Code; recommended: grill). Do not start coding.

## Complete

When the user says the ticket is complete, or says to commit and push:

1. Take the ticket key (the one just pulled, or the one they name).
2. If they said commit and push: in the implementation repo, commit with the ticket key in parentheses at the end of the subject (`… (RLD-336)`), then push. That phrase is push permission for this ticket.
3. From bluesurf-tools: `npm run ticket-done -- RLD-336`.
4. Done when `RLand/Tickets/RLD-336/` is gone. If they asked to push, the branch is also on the remote.
