import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  TARGET_HOURS,
  buildCalendarEfforts,
  isReportClosed,
  parseTicketOverride,
  planDailyReport,
  sumExecutedHours,
  toSavePayload,
} from "../src/daily-report.js";
import subcategories from "./fixtures/daily-report-subcategories.json" with { type: "json" };

const projects = [
  { id: "proj-rld", smallCode: "RLD", name: "RLD RLand" },
];

describe("daily-report planner", () => {
  it("parses ticket overrides", () => {
    assert.deepEqual(parseTicketOverride("RLD-100:2.5"), { code: "RLD-100", hours: 2.5 });
  });

  it("adds calendar lines when the report has none", async () => {
    const report = {
      id: "00000000-0000-0000-0000-000000000000",
      date: "2026-11-05T00:00:00",
      status: 0,
      reporterId: "user-1",
      efforts: [],
    };
    const calendar = [
      { summary: "RLD - Daily", duration: 0.25 },
      { summary: "Lunch", duration: 1 },
    ];
    const plan = await planDailyReport({
      date: "2026-11-05",
      report,
      calendar,
      projects,
      subcategories,
      overrides: [],
      workItemsEfforts: { workItems: [] },
    });
    assert.equal(plan.summary.meetingHours, 1.25);
    assert.equal(plan.report.efforts.length, 2);
    assert.equal(plan.report.efforts[0].projectId, "proj-rld");
    assert.equal(plan.report.efforts[1].projectId, undefined);
  });

  it("trims ticket hours to fit 8h after meetings", async () => {
    const report = {
      date: "2026-11-05T00:00:00",
      status: 0,
      reporterId: "user-1",
      efforts: buildCalendarEfforts({
        calendar: [{ summary: "RLD - Daily", duration: 0.25 }],
        projects,
        report: { reporterId: "user-1", date: "2026-11-05T00:00:00" },
        subcategories,
      }),
    };
    const plan = await planDailyReport({
      date: "2026-11-05",
      report,
      calendar: [],
      projects,
      subcategories,
      overrides: [{ code: "RLD-100", hours: 10 }],
      workItemsEfforts: { workItems: [] },
      resolveWorkItem: async () => ({
        id: "wi-100",
        code: "RLD-100",
        projectId: "proj-rld",
        estimatedEffort: 5,
      }),
    });
    assert.equal(plan.summary.totalHours, TARGET_HOURS);
    assert.match(plan.warnings.join(" "), /trimmed/i);
    const ticket = plan.report.efforts.find((e) => e.workItemId === "wi-100");
    assert.equal(ticket.executed, 7.75);
  });

  it("refuses save payload when report is confirmed", () => {
    assert.equal(isReportClosed({ status: 2 }), true);
    assert.throws(
      () => toSavePayload({ report: { status: 2, efforts: [] } }),
      /confirmed/,
    );
  });

  it("builds draft save payload with status 0", () => {
    const payload = toSavePayload({
      report: {
        id: "00000000-0000-0000-0000-000000000000",
        date: "2026-11-05T00:00:00",
        status: 0,
        reporterId: "user-1",
        reporterFullName: "Test User",
        efforts: [
          {
            description: "RLD - Daily",
            executed: 0.25,
            categoryId: "cat-google",
            subcategoryId: "sub-google",
            reporterId: "user-1",
            deleted: false,
            subcategories: [{ header: "noise" }],
          },
        ],
      },
    });
    assert.equal(payload.status, 0);
    assert.equal(payload.executedHours, 0.25);
    assert.equal(payload.efforts[0].subcategories, undefined);
    assert.equal(sumExecutedHours(payload.efforts), 0.25);
  });
});
