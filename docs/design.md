# Blue Surf tools — design

Local client and agent skills for **your** Blue Surf session. No public API. No SSO bypass.

## Decisions (locked)

| Topic | Choice |
| --- | --- |
| Data access | Persistent Chromium profile + replay the SPA’s private JSON APIs. DOM scrape is fallback only. |
| Distribution | **`bluesurf` CLI** (`@bluepeople/bluesurf`); config in `~/.config/bluesurf/config.toml`; session in `~/.local/share/bluesurf/session/` |
| Workstore | Resolved path for notes (not Obsidian-only). Default layout `Tickets/`, `Sprints/`. See [cli-spec.md](cli-spec.md). |
| After `/bluesurf-ticket` | Write workstore note + optional attachments, then **stop**. **Bugs Detected** (configurable tag) → implement from comments; else grill vs implement. |
| Ticket implement flow | grill → Matt **implement** (tdd, code-review) → **functional-test** (`Tickets/{code}/validation/`) → complete when **AGENTS.md** **Ticket done** gates are true. **bluesurf-ticket** orchestrates. |
| After the ticket is done | **`bluesurf ticket-done`** when gates pass; delete folder only if `ticket.done.delete_folder` in config (default true). Gates stay in **AGENTS.md** only. |
| Skills install | **`bluesurf setup`** symlinks skills into harnesses + `~/.agents/skills`; **`bluesurf upgrade`** relinks after package update |
| Chrome | Playwright persistent context under session dir (legacy: repo `.chrome-profile/`). Not your daily browser profile. |

## Layers

1. **Session** — Playwright + cookie jar. **`bluesurf login`** (headed) → cookies in `~/.local/share/bluesurf/session/surf-cookies.json`. Headless commands reload the jar (Surf’s auth cookie is session-scoped in Chromium).
2. **Client** — `src/client.js` calls the same JSON URLs as the SPA (`page.request` / `context.request`).
3. **Config** — TOML merge: global + `.surf/project.toml` + legacy `.env` in dev clone. **`resolveWorkstore`** feeds `createVault()`.
4. **Skills** — call **`bluesurf`** on PATH; on 401, **`bluesurf login`** and retry.

## Skills (target)

### `/bluesurf-ticket RLD-100`

1. `bluesurf ticket RLD-100` — fetch, write `Tickets/RLD-100/detail.md`, attachments per config.
2. Stop; route per tags and `ticket.after_pull`.
3. After functional-test + **Ticket done** gates: `bluesurf ticket-done RLD-100`.

### `/bluesurf-sprint`

`bluesurf sprint` — current sprint rows → `Sprints/Sprint N.md` (sort from config).

### `/bluesurf-daily-report`

`bluesurf daily-report fetch|plan|apply DATE` — agent skill calls CLI only; hours cap from config.

| Step | Call | Notes |
| --- | --- | --- |
| `fetch` | `GET /api/effort/myDailyReport/{date}` | Draft `status` 0 or confirmed 2 |
| | `GET /api/google/calendar/{date}` | `{ summary, duration }[]` |
| | `GET /api/WorkItems/efforts/{date}` | Ticket hints (often empty) |
| | `GET /api/user/current/subcategory` | Category picker rows |
| | `GET /api/project?includeCategories=true` | Projects + allowed categories |
| `plan` | (local) | Calendar rows if none yet; `--ticket` overrides; trim to 8h |
| `apply` | `POST /api/Effort/DailyReport` | Full report body, **`status: 0` only** — never 2 |

Captured 2026-11-05: Save POST mirrors `myDailyReport` shape; strip UI-only fields (e.g. embedded `subcategories` on new lines).

### `/bluesurf-daily-report`

`npm run daily-report -- fetch|plan|apply YYYY-MM-DD` (optional `--ticket CODE:hours`, `--json`). Agent skill calls the CLI only.

| Step | Call | Notes |
| --- | --- | --- |
| `fetch` | `GET /api/effort/myDailyReport/{date}` | Draft `status` 0 or confirmed 2 |
| | `GET /api/google/calendar/{date}` | `{ summary, duration }[]` |
| | `GET /api/WorkItems/efforts/{date}` | Ticket hints (often empty) |
| | `GET /api/user/current/subcategory` | Category picker rows |
| | `GET /api/project?includeCategories=true` | Projects + allowed categories |
| `plan` | (local) | Calendar rows if none yet; `--ticket` overrides; trim to 8h |
| `apply` | `POST /api/Effort/DailyReport` | Full report body, **`status: 0` only** — never 2 |

Captured 2026-11-05: Save POST mirrors `myDailyReport` shape; strip UI-only fields (e.g. embedded `subcategories` on new lines).

## Spike result (2026-09-10)

Origin in production is **`https://surf.bluepeople.com`**, not `bluesurf.bluepeople.com`.

Auth is a cookie session after `POST /api/login` (the SPA does this; **we do not replay email/password**). Early calls return 401 until that session exists. The client must reuse the Playwright profile’s cookies via `page.request` / `context.request`.

### Endpoints we will call

| Function | Call | Notes |
| --- | --- | --- |
| `getCurrentUser()` | `GET /api/instance/currentUser` | `id` is the assignee filter (your user id from this response). |
| `getWorkItem(code)` | `GET /api/workItem/{code}` | Confirmed with `RLD-336` and `RLD-339`. Includes `files[]`. |
| `getWorkItemVideos(code)` | `GET /api/WorkItem/{code}/videos` | Empty array on RLD-336 and RLD-339. |
| `getWorkItemFileName(workItemId, fileId)` | `GET /api/workItem/{workItemId}/fileName/{fileId}` | Plain text filename. Confirmed on RLD-339. |
| `downloadWorkItemFile(workItemId, fileId)` | `GET /api/workItem/{workItemId}/file/{fileId}` | Bytes. From SPA `downloadFile`. |
| image preview | `GET /api/workItem/{workItemId}/image/{fileId}` | When `file.isImage`. |
| `listMyProjects()` | `GET /api/user/current/project` | `smallCode` is `RLD`. |
| `getKanban(projectCode, filters)` | `POST /api/project/{code}/kanban?skipWorkItems=false` | Board + work items. |
| `listPriorities()` | `GET /api/Enums/WorkItemPriority` | 5=Highest … 1=Lowest. |
| `listTypes()` | `GET /api/Enums/WorkItemType` | userStory, bug, issue, task, … |
| `getBoards(projectCode)` | `POST /api/project/{code}/kanban?skipWorkItems=true` | Statuses only. One board per work item `type` (0 user story, 1, 3 task seen), each with its **own** status ids. `destinations` is empty: no transition rules. |
| `moveWorkItemOnBoard(id, statusId, position)` | `POST /api/WorkItem/{workItemId}/moveOnBoard/{statusId}/{position}` | No body. `position` is the slot in the target column (UI drops sent 2 and 3; we send 0 = top). Returns the updated work item. Captured 2026-09-28 moving RLD-387 and RLD-388. |
| project hub | SignalR `wss://…/api/hub/projectHub` | After a move the UI invokes `JoinGroup [code]` then `ProjectUpdated [code, workItemId]` so other open boards refresh. |

Kanban filter body (empty arrays mean “all”):

```json
{
  "statuses": [],
  "tags": [],
  "sprints": [],
  "priorities": [],
  "assignedTo": ["<currentUser.id>"],
  "reportedBy": [],
  "colors": [],
  "defectsOrigins": [],
  "tagCondition": "and",
  "search": "",
  "quantityPerStatus": []
}
```

The UI’s “assigned to me” view is exactly that POST with `assignedTo: [currentUser.id]`.

### Ticket fields (`GET /api/workItem/{code}`)

`code`, `id`, `name`, `description` (HTML), `typeDisplayName`, `priority` (int) + `priorityName`, `statusName`, `currentSprintId`, `currentSprintName` (e.g. `Sprint 14`), `assignedToFullName`, `reportedByFullName`, `estimatedEffort`, `totalHours`, `comments[]`, `changes[]`, `efforts[]`, `tags` (seen on kanban cards as `tagName`), `files[]`.

Each file: `id`, `workItemId`, `isImage`. `name` is filled by `GET .../fileName/{id}`. Download is `GET .../file/{id}`. Image preview is `GET .../image/{id}`.

### Sprint fields (kanban cards)

Each work item: `code`, `name`, `priority` / `priorityName`, `estimatedEffort`, `typeDisplayName`, `tags[].tagName`, `currentSprintId` / `currentSprintName`, `sprints[]`.

### Gaps

1. **Sprint list endpoint** — board filter still sends `sprints: []`. SPA source also has `POST /api/projectSprint` (save) and `POST /api/workItems/byProperty/sprint` (assign). No dedicated list GET in the captures. Keep inferring the current sprint from `currentSprintId` on kanban cards.
2. **Attachments** — `GET /api/workItem/{id}/file/{fileId}`; **`bluesurf ticket`** when `pull.download_attachments` is true.
3. **Sprint note** — **`bluesurf sprint`** / **`bluesurf sprint-review`**; same pending/done tables; effort from `totalExecuted` on full work item. Current sprint = highest sprint number on assigned cards (see `latestCurrentSprintId` caveat in code).

## Client modules (implemented)

`src/session.js`, `src/client.js`, `src/vault.js`, `src/export-*.js`, `src/daily-report.js`, config/workstore in `src/config/*` and `src/runtime-context.js`. Entry: `bin/bluesurf.mjs`.

Never call `POST /api/login` from our code.

## Out of scope

- Bypassing SSO or sharing someone else’s session
- Committing session state, cookies, or `~/.config/bluesurf/config.toml` with secrets
- Auto-implementing from a ticket
- Pushing this repo anywhere unless you ask
