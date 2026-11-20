import { parseCommonArgs } from "../argv.js";
import {
  applyDailyReport,
  fetchDailyReportBundle,
  parseTicketOverrides,
  planDailyReport,
} from "../daily-report.js";
import { loadRuntimeContext } from "../runtime-context.js";
import { createSessionClient } from "../session.js";

export async function dailyReportCommand(argv) {
  const command = argv[0];
  const date = argv[1];
  const rest = argv.slice(2);
  const { options } = parseCommonArgs(rest);
  const json = options.json || rest.includes("--json");
  const overrides = parseTicketOverrides(rest);

  if (!command || !date || !["fetch", "plan", "apply"].includes(command)) {
    console.error(`Usage:
  bluesurf daily-report fetch YYYY-MM-DD [--json] [--cwd path]
  bluesurf daily-report plan YYYY-MM-DD [--ticket CODE:hours ...] [--json]
  bluesurf daily-report apply YYYY-MM-DD [--ticket CODE:hours ...] [--json]`);
    return 1;
  }

  const ctx = await loadRuntimeContext({ cwd: options.cwd, projectCode: options.projectCode });
  const targetHours = Number(ctx.config.daily_report?.hours_cap ?? 8);
  const client = await createSessionClient({
    origin: ctx.origin,
    headless: options.headless,
    session: ctx.session,
  });

  try {
    if (command === "fetch") {
      const bundle = await fetchDailyReportBundle(client, date);
      if (json) {
        console.log(JSON.stringify(bundle, null, 2));
      } else {
        console.log(
          `${date}: status ${bundle.report.status}${bundle.cerrado ? " (confirmed)" : ""}, ` +
            `${bundle.report.executedHours ?? 0}h, ${bundle.calendar.length} calendar events`,
        );
      }
      return 0;
    }

    const bundle = await fetchDailyReportBundle(client, date);
    const plan = await planDailyReport({
      date,
      report: bundle.report,
      calendar: bundle.calendar,
      projects: bundle.projects,
      subcategories: bundle.subcategories,
      overrides,
      workItemsEfforts: bundle.workItemsEfforts,
      resolveWorkItem: (code) => client.getWorkItem(code),
      targetHours,
    });

    if (command === "plan") {
      if (json) {
        console.log(JSON.stringify(plan, null, 2));
      } else {
        console.log(
          `Plan ${date}: ${plan.summary.totalHours}h ` +
            `(${plan.summary.meetingHours}h meetings + ${plan.summary.ticketHours}h tickets)`,
        );
        for (const warning of plan.warnings) console.log(`  warning: ${warning}`);
        if (plan.cerrado) console.log("  report is confirmed — apply will refuse");
      }
      return 0;
    }

    const result = await applyDailyReport(client, plan);
    if (json) {
      console.log(JSON.stringify({ plan, saved: result.saved }, null, 2));
    } else {
      console.log(
        `Applied ${date}: draft saved (${plan.summary.totalHours}h, ${plan.summary.ticketHours}h tickets).`,
      );
    }
    return 0;
  } finally {
    await client.close();
  }
}