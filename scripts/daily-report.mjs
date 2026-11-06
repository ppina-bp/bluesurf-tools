import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../src/env.js";
import {
  applyDailyReport,
  fetchDailyReportBundle,
  parseTicketOverrides,
  planDailyReport,
} from "../src/daily-report.js";
import { createSessionClient } from "../src/session.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadEnvFile(path.join(root, ".env"));

const argv = process.argv.slice(2);
const command = argv[0];
const date = argv[1];
const rest = argv.slice(2);
const json = rest.includes("--json");
const overrides = parseTicketOverrides(rest);

function usage() {
  console.error(`Usage:
  npm run daily-report -- fetch YYYY-MM-DD [--json]
  npm run daily-report -- plan YYYY-MM-DD [--ticket CODE:hours ...] [--json]
  npm run daily-report -- apply YYYY-MM-DD [--ticket CODE:hours ...] [--json]`);
  process.exit(1);
}

if (!command || !date || ["fetch", "plan", "apply"].includes(command) === false) {
  usage();
}

const headless = process.env.BLUESURF_HEADED !== "1";
const client = await createSessionClient({
  origin: process.env.BLUESURF_ORIGIN,
  headless,
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
  } else {
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
    } else {
      const result = await applyDailyReport(client, plan);
      if (json) {
        console.log(JSON.stringify({ plan, saved: result.saved }, null, 2));
      } else {
        console.log(
          `Saved ${date}: status ${result.saved.status}, ${result.saved.executedHours}h, ` +
            `${result.saved.efforts?.length ?? 0} activities`,
        );
        for (const warning of plan.warnings) console.log(`  warning: ${warning}`);
      }
    }
  }
} finally {
  await client.close();
}
