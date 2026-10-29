---
name: functional-test
description: Run functional acceptance checks after implementation — Playwright subagent for UI, smoke matrix for CLI/API — write report and manual-reproduction steps under the Surf ticket validation folder. Use when bluesurf-ticket requires post-implement verification, when the user asks for functional or acceptance testing on a Surf ticket, or after implement and code-review on pulled ticket work.
---

Blue Surf acceptance layer after Matt Pocock **implement** (which already ran **tdd**, **code-review**, and **commit**). Hard gate for **bluesurf-ticket** complete.

Do not edit Matt Pocock skills; this skill only adds Surf verification.

## Prerequisites

Settled before you start:

1. **Spec** — pulled ticket `detail.md` plus the confirmed plan from the chat, including a **Functional checks** section.
2. **Implement done** — **implement** finished for this ticket (including its commit). **code-review** had no blocking/high findings (nits may remain).
3. **Dev server** — the human already runs the app. Read the implementation repo **AGENTS.md** (from `bluesurf-tools/templates/AGENTS.md.template` if missing, ask the human to add it). Use base URL, health endpoint, and auth from the **Functional testing** section. Fail fast if health check fails; tell the human to start dev per AGENTS.md.
4. **Ticket key** — e.g. `PRY-XXX` (project code + number) for vault paths.

## Process

### 1. Choose the runner path

| Signal | Path |
| --- | --- |
| Functional checks or ticket imply browser/UI | **Playwright subagent** (below) |
| Otherwise | **Smoke matrix** (below) |

Always run one path; non-UI work still gets a smoke matrix pass.

### 2. Smoke matrix (non-UI or before UI when both apply)

In the implementation workspace (current cwd):

1. If `package.json` defines `test:smoke`, run it.
2. Else if the plan names a CLI entry, run `--help` or the documented smoke command.
3. Else if AGENTS.md names a health URL, `curl -sf` it (or equivalent).
4. Else run the repo’s full test script (`npm test` / documented equivalent).

Done when the chosen command exits 0. On failure, go to **Failure loop**.

### 3. Playwright subagent

Spawn a **Task** subagent (generalPurpose or equivalent) with a single job:

- Work in the **implementation repo** cwd.
- Do **not** start or stop the dev server; use the base URL from AGENTS.md.
- Reuse **storageState** or env test credentials when AGENTS.md documents them; otherwise call **wizard** once to capture auth, then reuse storageState for reruns in the same ticket.
- If the repo has no Playwright dependency, use **`npx playwright`** with an ephemeral script (do not add `@playwright/test` to the repo unless the human asks).
- Execute every bullet under **Functional checks** from the confirmed plan against the running app.
- On failure: save trace/screenshot; on pass: screenshot key states.
- Return a short structured result: pass/fail, commands run, paths to artifacts, and enough detail to write **Manual reproduction** (step 5).

Parent agent: wait for the subagent, then write artifacts (steps 4–5).

### 4. Validation folder (vault)

Under the BluePeople vault (see **bluesurf-ticket** / `OBSIDIAN_VAULT`):

`RLand/Tickets/{code}/validation/`

Write:

- `report.md` — what ran, pass/fail, links to screenshots, subagent notes (redact secrets). Do **not** put manual steps here; they go in step 5.
- Screenshots (and trace zip on failure) alongside the report.

### 5. Manual reproduction (last step)

Always finish with human-runnable steps that mirror exactly what the agent did — same order, same URLs, same commands, same expected outcomes. A human with no agent access should be able to repeat the run from this file alone.

Write `manual-reproduction.md` in the same `validation/` folder:

1. **Prerequisites** — how to start dev (command from AGENTS.md, base URL, health check). If login is required: how a human signs in (no secrets; reference env vars or “use your SSO account”).
2. **Steps** — numbered list. For each **Functional checks** bullet and each smoke/CLI command executed:
   - UI: URL to open, clicks/inputs in plain language, what to look for (pass/fail).
   - CLI/HTTP: full copy-paste commands and expected exit code or response snippet.
3. **Expected result** — one line per step or a short closing “all steps pass when …”.

Use the same step numbering the agent followed; if the agent re-ran a step, document the final successful path.

Give the human a **brief summary in chat** and point to `manual-reproduction.md`.

Done when `validation/report.md` and `validation/manual-reproduction.md` exist and reflect the latest run.

## Failure loop

On fail:

1. Summarize failures (chat + update `validation/report.md`; leave `manual-reproduction.md` stale or note “failed run” until a passing rerun completes step 5).
2. Call **implement** with **tdd** to fix, then **code-review** again (must reach no blockers). **implement** commits when it finishes.
3. Re-run this skill from step 1.

Stop after **3** full implement → functional cycles. Then stop and ask the human how to proceed.

## Out of scope

- Replacing unit/integration tests (**tdd** still owns those).
- Git commit ( **implement** owns commit unless follow-up fixes need a new commit before push).
- Pushing or running **ticket-done** (human says ticket complete / commit and push for that).
