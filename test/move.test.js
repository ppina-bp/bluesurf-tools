import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createClient } from "../src/client.js";
import { findBoardStatus } from "../src/model.js";

const names = [
  "Backlog",
  "Blocked",
  "Analysis (IN PROGRESS)",
  "Analysis (DONE)",
  "Development (IN PROGRESS)",
  "Development (DONE)",
  " Testing (IN PROGRESS)",
  "Testing (DONE)",
  "Validation (IN PROGRESS)",
  "Validation (BLOCKED)",
  "Validation (DONE)",
];
const board = (type) => ({
  type,
  statuses: names.map((name, index) => ({ id: `t${type}-s${index}`, name })),
});
const boards = [board(0), board(3)];

describe("findBoardStatus", () => {
  it("resolves the status on the board for the item's type", () => {
    assert.equal(findBoardStatus(boards, 0, "Development (DONE)").id, "t0-s5");
    assert.equal(findBoardStatus(boards, 3, "Development (DONE)").id, "t3-s5");
  });

  it("accepts loose names and ignores stray whitespace in Surf's names", () => {
    assert.equal(findBoardStatus(boards, 3, "dev done").id, "t3-s5");
    assert.equal(findBoardStatus(boards, 3, "testing in progress").id, "t3-s6");
    assert.equal(findBoardStatus(boards, 3, "val blocked").id, "t3-s9");
  });

  it("prefers an exact name over a partial match", () => {
    assert.equal(findBoardStatus(boards, 3, "blocked").id, "t3-s1");
  });

  it("rejects ambiguous and unknown names with the options", () => {
    assert.throws(() => findBoardStatus(boards, 3, "done"), /matches Analysis \(DONE\), Development \(DONE\)/);
    assert.throws(() => findBoardStatus(boards, 3, "shipped"), /No status "shipped". Options: Backlog/);
    assert.throws(() => findBoardStatus(boards, 1, "done"), /No board for work item type 1/);
  });
});

describe("move", () => {
  function client(movedStatusId) {
    const calls = [];
    const api = createClient({
      request: async (method, path) => {
        calls.push(`${method} ${path}`);
        if (path === "/api/workItem/RLD-388") {
          return { id: "wi-388", type: 3, statusId: "t3-s4", statusName: "Development (IN PROGRESS)" };
        }
        if (path === "/api/project/RLD/kanban?skipWorkItems=true") return boards;
        if (path.includes("/moveOnBoard/")) return { statusId: movedStatusId, statusName: "Development (DONE)" };
        throw new Error(`unexpected ${method} ${path}`);
      },
    });
    return { api, calls };
  }

  it("plans a move without changing anything", async () => {
    const { api, calls } = client();
    const plan = await api.planMove("RLD-388", "dev done");
    assert.deepEqual(plan, {
      code: "RLD-388",
      projectCode: "RLD",
      workItemId: "wi-388",
      from: "Development (IN PROGRESS)",
      to: "Development (DONE)",
      statusId: "t3-s5",
      unchanged: false,
    });
    assert.ok(calls.every((call) => !call.includes("moveOnBoard")));
  });

  it("moves to the top of the target column and checks Surf's answer", async () => {
    const { api, calls } = client("t3-s5");
    await api.moveWorkItem(await api.planMove("RLD-388", "dev done"));
    assert.equal(calls.at(-1), "POST /api/WorkItem/wi-388/moveOnBoard/t3-s5/0");
  });

  it("fails when Surf reports a different status after the move", async () => {
    const { api } = client("t3-s4");
    await assert.rejects(api.moveWorkItem(await api.planMove("RLD-388", "dev done")), /RLD-388 did not move/);
  });
});
