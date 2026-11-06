import { parseTicketKey } from "./model.js";

export const TARGET_HOURS = 8;
export const STATUS_DRAFT = 0;
export const STATUS_CONFIRMED = 2;

const GOOGLE_CATEGORY = "Google";
const GOOGLE_SUBCATEGORY = "Google Calendar";
const DEV_CATEGORY = "Desarrollo";
const DEV_SUBCATEGORY = "Construcción / Codificación";

const EMPTY_ID = "00000000-0000-0000-0000-000000000000";

export function assertDateString(date) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    throw new Error(`Invalid date (use YYYY-MM-DD): ${date}`);
  }
}

export function isReportClosed(report) {
  return report?.status === STATUS_CONFIRMED;
}

export function parseTicketOverride(raw) {
  const match = /^([A-Z]+-\d+):(\d+(?:\.\d+)?)$/.exec(raw.trim());
  if (!match) {
    throw new Error(`Invalid --ticket (use CODE:hours): ${raw}`);
  }
  parseTicketKey(match[1]);
  return { code: match[1], hours: Number(match[2]) };
}

export function parseTicketOverrides(argv) {
  const tickets = [];
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--ticket" && argv[i + 1]) {
      tickets.push(parseTicketOverride(argv[i + 1]));
      i++;
    }
  }
  return tickets;
}

export function isGoogleCalendarEffort(effort) {
  if (!effort || effort.deleted || effort.workItemId) return false;
  return (
    effort.subcategoryName === GOOGLE_SUBCATEGORY ||
    effort.categoryName === GOOGLE_CATEGORY ||
    (effort.description && !effort.workItemId && effort.categoryId && effort.subcategoryId)
  );
}

export function hasGoogleCalendarLines(efforts = []) {
  return efforts.some(isGoogleCalendarEffort);
}

export function sumExecutedHours(efforts = []) {
  return efforts.filter((e) => !e.deleted).reduce((sum, e) => sum + (e.executed ?? 0), 0);
}

export function parseCalendarProjectCode(summary) {
  const match = /^([A-Z]+)\s[-–—]/.exec(summary?.trim() ?? "");
  return match?.[1] ?? null;
}

export function findSubcategory(subcategories, categoryName, subcategoryName) {
  return subcategories.find(
    (row) => row.categoryName === categoryName && row.name === subcategoryName,
  );
}

export function findProjectBySmallCode(projects, smallCode) {
  if (!smallCode) return null;
  return projects.find((p) => p.smallCode === smallCode) ?? null;
}

export function toReportDateIso(date) {
  return `${date}T00:00:00`;
}

export function buildCalendarEfforts({ calendar, projects, report, subcategories }) {
  const google = findSubcategory(subcategories, GOOGLE_CATEGORY, GOOGLE_SUBCATEGORY);
  if (!google) {
    throw new Error(`Missing subcategory ${GOOGLE_CATEGORY} / ${GOOGLE_SUBCATEGORY}`);
  }

  const reporterId = report.reporterId;
  const dateIso = report.date ?? toReportDateIso(report.dateOnly);

  return calendar.map((event) => {
    const projectCode = parseCalendarProjectCode(event.summary);
    const project = findProjectBySmallCode(projects, projectCode);
    const line = {
      description: event.summary,
      executed: event.duration,
      effective: 0,
      date: dateIso,
      categoryId: google.categoryId,
      subcategoryId: google.id,
      reporterId,
      deleted: false,
    };
    if (project) {
      line.projectId = project.id;
    }
    return line;
  });
}

export function buildDevTicketEffort({
  workItem,
  hours,
  project,
  subcategories,
  report,
  description = "",
}) {
  const dev = findSubcategory(subcategories, DEV_CATEGORY, DEV_SUBCATEGORY);
  if (!dev) {
    throw new Error(`Missing subcategory ${DEV_CATEGORY} / ${DEV_SUBCATEGORY}`);
  }
  const dateIso = report.date ?? toReportDateIso(report.dateOnly);
  return {
    description,
    executed: hours,
    pending: 0,
    effective: 0,
    date: dateIso,
    categoryId: dev.categoryId,
    subcategoryId: dev.id,
    reporterId: report.reporterId,
    projectId: project?.id ?? workItem.projectId,
    workItemId: workItem.id,
    deleted: false,
  };
}

function ticketEntriesFromEffortsApi(workItemsEfforts) {
  const items = workItemsEfforts?.workItems ?? [];
  return items
    .filter((item) => item?.code)
    .map((item) => ({
      code: item.code,
      hours: item.hours ?? item.executed ?? item.estimatedEffort ?? 0,
      workItem: item,
      project: item.project,
    }));
}

function mergeTicketRequests({ overrides, workItemsEfforts }) {
  const byCode = new Map();
  for (const entry of ticketEntriesFromEffortsApi(workItemsEfforts)) {
    byCode.set(entry.code, entry);
  }
  for (const override of overrides) {
    byCode.set(override.code, {
      code: override.code,
      hours: override.hours,
      workItem: byCode.get(override.code)?.workItem,
      project: byCode.get(override.code)?.project,
    });
  }
  return [...byCode.values()].filter((entry) => entry.hours > 0);
}

function upsertTicketEffort(efforts, line) {
  const index = efforts.findIndex((e) => e.workItemId === line.workItemId && !e.deleted);
  if (index >= 0) {
    efforts[index] = { ...efforts[index], ...line, executed: line.executed };
  } else {
    efforts.push(line);
  }
}

function scaleTicketHours(efforts, meetingHours, warnings) {
  const ticketLines = efforts.filter((e) => e.workItemId && !e.deleted);
  const ticketTotal = sumExecutedHours(ticketLines);
  const budget = TARGET_HOURS - meetingHours;
  if (budget < 0) {
    warnings.push(`Meetings already exceed ${TARGET_HOURS}h (${meetingHours}h); ticket hours set to 0.`);
    for (const line of ticketLines) line.executed = 0;
    return;
  }
  if (ticketTotal <= budget || ticketTotal === 0) return;
  const factor = budget / ticketTotal;
  warnings.push(
    `Ticket hours trimmed from ${ticketTotal}h to ${budget}h to reach ${TARGET_HOURS}h after meetings.`,
  );
  for (const line of ticketLines) {
    line.executed = Math.round(line.executed * factor * 100) / 100;
  }
}

export async function planDailyReport({
  date,
  report,
  calendar,
  projects,
  subcategories,
  overrides = [],
  workItemsEfforts = { workItems: [] },
  resolveWorkItem,
}) {
  assertDateString(date);
  const warnings = [];
  const cerrado = isReportClosed(report);

  const dateOnly = date;
  const base = {
    ...report,
    date: report.date ?? toReportDateIso(dateOnly),
    dateOnly,
    status: STATUS_DRAFT,
  };

  const efforts = (report.efforts ?? []).filter((e) => !e.deleted).map((e) => ({ ...e }));

  if (!hasGoogleCalendarLines(efforts) && calendar?.length) {
    efforts.push(...buildCalendarEfforts({ calendar, projects, report: base, subcategories }));
  }

  const meetingHours = sumExecutedHours(efforts.filter((e) => !e.workItemId));
  const ticketRequests = mergeTicketRequests({ overrides, workItemsEfforts });

  for (const request of ticketRequests) {
    let workItem = request.workItem;
    if (!workItem?.id && typeof resolveWorkItem === "function") {
      workItem = await resolveWorkItem(request.code);
    }
    if (!workItem?.id) {
      warnings.push(`Skipped ${request.code}: work item not found.`);
      continue;
    }
    const { projectCode } = parseTicketKey(request.code);
    const project = findProjectBySmallCode(projects, projectCode);
    upsertTicketEffort(
      efforts,
      buildDevTicketEffort({
        workItem,
        hours: request.hours,
        project,
        subcategories,
        report: base,
      }),
    );
  }

  scaleTicketHours(efforts, meetingHours, warnings);

  const executedHours = sumExecutedHours(efforts);
  if (executedHours < TARGET_HOURS && ticketRequests.length === 0) {
    warnings.push(`Only ${executedHours}h planned; pass --ticket CODE:hours for ticket work.`);
  } else if (executedHours < TARGET_HOURS) {
    warnings.push(`Day totals ${executedHours}h, under ${TARGET_HOURS}h target.`);
  }

  const planned = {
    ...base,
    id: base.id && base.id !== EMPTY_ID ? base.id : EMPTY_ID,
    executedHours,
    activitiesCount: efforts.filter((e) => !e.deleted).length,
    efforts,
  };

  return {
    date: dateOnly,
    cerrado,
    warnings,
    report: planned,
    summary: {
      totalHours: executedHours,
      meetingHours,
      ticketHours: sumExecutedHours(efforts.filter((e) => e.workItemId)),
      targetHours: TARGET_HOURS,
    },
  };
}

const SAVE_EFFORT_KEYS = new Set([
  "id",
  "description",
  "executed",
  "pending",
  "effective",
  "date",
  "categoryId",
  "subcategoryId",
  "reporterId",
  "projectId",
  "billableId",
  "workItemId",
  "deleted",
  "projectCategories",
  "linkedItem",
  "taskEstimatedEffort",
  "taskTotalExecuted",
  "taskProjectId",
  "workItemEstimatedEffort",
  "workItemTotalExecuted",
  "workItemProjectId",
  "workItemLinkedWorkItems",
]);

export function sanitizeEffortForSave(effort) {
  const out = {};
  for (const key of SAVE_EFFORT_KEYS) {
    if (effort[key] !== undefined) out[key] = effort[key];
  }
  return out;
}

export function toSavePayload(plan) {
  const report = plan.report ?? plan;
  if (isReportClosed(report) || isReportClosed(plan)) {
    throw new Error("Daily report is confirmed (status 2); cannot save.");
  }
  const efforts = (report.efforts ?? []).filter((e) => !e.deleted).map(sanitizeEffortForSave);
  return {
    id: report.id ?? EMPTY_ID,
    date: report.date,
    status: STATUS_DRAFT,
    reporterId: report.reporterId,
    reporterFullName: report.reporterFullName,
    activitiesCount: efforts.length,
    executedHours: sumExecutedHours(efforts),
    efforts,
  };
}

export async function fetchDailyReportBundle(client, date) {
  assertDateString(date);
  const [report, calendar, workItemsEfforts, subcategories, projects] = await Promise.all([
    client.getMyDailyReport(date),
    client.getGoogleCalendar(date),
    client.getWorkItemsEfforts(date),
    client.listCurrentSubcategories(),
    client.listProjectsWithCategories(),
  ]);
  return {
    date,
    report,
    calendar,
    workItemsEfforts,
    subcategories,
    projects,
    cerrado: isReportClosed(report),
  };
}

export async function applyDailyReport(client, planResult) {
  if (planResult.cerrado) {
    const error = new Error("Daily report is confirmed (status 2); refusing to save.");
    error.code = "REPORT_CLOSED";
    throw error;
  }
  const payload = toSavePayload(planResult);
  await client.saveDailyReport(payload);
  const saved = await client.getMyDailyReport(planResult.date);
  if (saved.status !== STATUS_DRAFT) {
    throw new Error(`Save returned unexpected status ${saved.status}; expected draft (${STATUS_DRAFT}).`);
  }
  return { saved, payload };
}
