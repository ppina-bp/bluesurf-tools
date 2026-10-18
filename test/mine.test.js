import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { formatMyTickets, groupMyTickets, isDoneItem } from "../src/model.js";

const items = [
  { code: "RLD-245", name: "Agreements tab", statusName: "Validation (DONE)", statusIsFinal: true, priority: 3, priorityName: "Medium", estimatedEffort: 2, currentSprintName: "Sprint 11" },
  { code: "RLD-244", name: "Wells tab", statusName: "Validation (BLOCKED)", priority: 3, priorityName: "Medium", estimatedEffort: 2, currentSprintName: "Sprint 11" },
  { code: "RLD-387", name: "Search button", statusName: "Development (IN PROGRESS)", priority: 3, priorityName: "Medium", estimatedEffort: 3, currentSprintName: "Sprint 15" },
  { code: "RLD-388", name: "Bench depths", statusName: "Development (IN PROGRESS)", priority: 4, priorityName: "High", estimatedEffort: 5, currentSprintName: "Sprint 15", tags: [{ tagName: "Loader" }] },
  { code: "RLD-372", name: "Deal Summary", statusName: "Testing (DONE)", statusIsFinal: false, priority: 3, priorityName: "Medium", estimatedEffort: 3, currentSprintName: "Sprint 14" },
  { code: "RLD-129", name: "Loading Tracts UX", statusName: "Validation (IN PROGRESS)", priority: 5, priorityName: "Highest", estimatedEffort: 30, currentSprintName: "Sprint 7" },
  { code: "RLD-1", name: "Unplanned", statusName: "Backlog", priority: 1, priorityName: "Lowest", estimatedEffort: 0, currentSprintName: null },
];

describe("isDoneItem", () => {
  it("treats only the final status as done, not stage DONE columns", () => {
    assert.equal(isDoneItem({ statusName: "Validation (DONE)", statusIsFinal: true }), true);
    assert.equal(isDoneItem({ statusName: "Testing (DONE)", statusIsFinal: false }), false);
    assert.equal(isDoneItem({ statusName: "Analysis (DONE)" }), false);
    assert.equal(isDoneItem({ statusName: "Backlog", statusIsFinal: false }), false);
  });
});

describe("groupMyTickets", () => {
  it("hides final items but keeps stage DONE columns, orders sprints newest first with no sprint last, and sorts by priority", () => {
    const groups = groupMyTickets(items);
    assert.deepEqual(
      groups.map((group) => [group.sprint, group.items.map((row) => row.code)]),
      [
        ["Sprint 15", ["RLD-388", "RLD-387"]],
        ["Sprint 14", ["RLD-372"]],
        ["Sprint 11", ["RLD-244"]],
        ["Sprint 7", ["RLD-129"]],
        ["No sprint", ["RLD-1"]],
      ],
    );
    assert.deepEqual(groups[0].items[0], {
      code: "RLD-388",
      title: "Bench depths",
      status: "Development (IN PROGRESS)",
      priority: "High",
      estimatedHours: 5,
      type: "",
      tags: ["Loader"],
      sprint: "Sprint 15",
    });
  });

  it("includes final items when all is set", () => {
    const sprint11 = groupMyTickets(items, { all: true }).find((group) => group.sprint === "Sprint 11");
    assert.deepEqual(sprint11.items.map((row) => row.code), ["RLD-245", "RLD-244"]);
  });
});

describe("formatMyTickets", () => {
  it("prints one header per sprint and one line per ticket", () => {
    const text = formatMyTickets(groupMyTickets(items).slice(0, 1));
    assert.equal(
      text,
      [
        "Sprint 15 (2)",
        "  RLD-388  Development (IN PROGRESS)  High  5h  Bench depths",
        "  RLD-387  Development (IN PROGRESS)  Medium  3h  Search button",
      ].join("\n"),
    );
  });
});
