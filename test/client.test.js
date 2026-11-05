import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../src/client.js";

function mockRequest(routes) {
  return async (method, path, body) => {
    const key = `${method} ${path}`;
    const hit = routes[key];
    if (!hit) throw new Error(`unexpected ${key}`);
    if (hit.status && hit.status >= 400) {
      const error = new Error(`Blue Surf ${hit.status} on ${path}`);
      error.status = hit.status;
      throw error;
    }
    return hit.body;
  };
}

describe("createClient", () => {
  it("loads a work item by code", async () => {
    const client = createClient({
      request: mockRequest({
        "GET /api/workItem/RLD-336": {
          body: { code: "RLD-336", name: "Add legal-location fields", priority: 4 },
        },
      }),
    });
    const item = await client.getWorkItem("RLD-336");
    assert.equal(item.code, "RLD-336");
    assert.equal(item.name, "Add legal-location fields");
  });

  it("lists my current-sprint items via assignedTo kanban with every column uncapped", async () => {
    const calls = [];
    const client = createClient({
      request: async (method, path, body) => {
        calls.push({ method, path, body });
        if (path === "/api/instance/currentUser") {
          return { id: "user-1", fullName: "Pato" };
        }
        if (path === "/api/project/RLD/kanban?skipWorkItems=true") {
          return [{ type: 0, statuses: [{ id: "s-doing", name: "Doing" }, { id: "s-done", name: "Done" }] }];
        }
        if (path === "/api/project/RLD/kanban?skipWorkItems=false") {
          return [
            {
              statuses: [
                {
                  name: "Doing",
                  workItems: [
                    {
                      code: "RLD-336",
                      name: "Legal fields",
                      priority: 4,
                      priorityName: "High",
                      typeDisplayName: "User Story",
                      estimatedEffort: 3,
                      currentSprintId: "sprint-14",
                      currentSprintName: "Sprint 14",
                      tags: [{ tagName: "Agreements" }],
                    },
                    {
                      code: "RLD-340",
                      name: "Old",
                      priority: 5,
                      currentSprintId: "sprint-13",
                      currentSprintName: "Sprint 13",
                      tags: [],
                    },
                    {
                      code: "RLD-337",
                      name: "Also 14",
                      priority: 3,
                      currentSprintId: "sprint-14",
                      currentSprintName: "Sprint 14",
                      tags: [],
                    },
                  ],
                },
              ],
            },
          ];
        }
        if (path === "/api/workItem/RLD-336") {
          return { code: "RLD-336", estimatedEffort: 3, totalHours: 3.75, totalExecuted: 3, statusName: "Development (IN PROGRESS)" };
        }
        if (path === "/api/workItem/RLD-337") {
          return { code: "RLD-337", estimatedEffort: 2, totalHours: 2.5, totalExecuted: 0 };
        }
        throw new Error(`unexpected ${method} ${path}`);
      },
    });

    const rows = await client.listMyCurrentSprintRows("RLD");
    assert.deepEqual(calls[0], { method: "GET", path: "/api/instance/currentUser", body: undefined });
    assert.equal(calls[1].path, "/api/project/RLD/kanban?skipWorkItems=true");
    assert.equal(calls[2].path, "/api/project/RLD/kanban?skipWorkItems=false");
    assert.deepEqual(calls[2].body.assignedTo, ["user-1"]);
    assert.deepEqual(calls[2].body.quantityPerStatus, [
      { statusId: "s-doing", quantity: 1000 },
      { statusId: "s-done", quantity: 1000 },
    ]);
    assert.deepEqual(
      rows.map((row) => row.code),
      ["RLD-336", "RLD-337"],
    );
    assert.equal(rows[0].estimatedHours, 3);
    assert.equal(rows[0].effortHours, 3);
    assert.equal(rows[0].status, "Development (IN PROGRESS)");
    assert.deepEqual(rows[0].tags, ["Agreements"]);
  });

  it("lists work item files and fills missing names", async () => {
    const client = createClient({
      request: mockRequest({
        "GET /api/workItem/RLD-339": {
          body: {
            code: "RLD-339",
            id: "item-1",
            files: [
              { id: "file-1", workItemId: "item-1", isImage: true },
              { id: "file-2", workItemId: "item-1", isImage: false, name: "notes.pdf" },
            ],
          },
        },
        "GET /api/workItem/item-1/fileName/file-1": {
          body: "CleanShot 2026-09-04 at 14.31.46.png",
        },
      }),
    });

    const files = await client.listWorkItemFiles("RLD-339");
    const note = await client.getTicketNote("RLD-339");
    assert.match(note, /\*\*Attachments:\*\* CleanShot 2026-09-04 at 14.31.46.png, notes.pdf/);
    assert.deepEqual(files, [
      {
        id: "file-1",
        workItemId: "item-1",
        name: "CleanShot 2026-09-04 at 14.31.46.png",
        isImage: true,
        filePath: "/api/workItem/item-1/file/file-1",
        fileNamePath: "/api/workItem/item-1/fileName/file-1",
        imagePath: "/api/workItem/item-1/image/file-1",
      },
      {
        id: "file-2",
        workItemId: "item-1",
        name: "notes.pdf",
        isImage: false,
        filePath: "/api/workItem/item-1/file/file-2",
        fileNamePath: "/api/workItem/item-1/fileName/file-2",
        imagePath: null,
      },
    ]);
  });

  it("tells the user to log in again on 401", async () => {
    const client = createClient({
      request: mockRequest({
        "GET /api/workItem/RLD-336": { status: 401, body: "" },
      }),
    });
    await assert.rejects(() => client.getWorkItem("RLD-336"), /npm run login/);
  });
});
