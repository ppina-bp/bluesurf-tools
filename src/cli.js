import { readFile } from "node:fs/promises";
import { packageRoot } from "./paths.js";
import { setupCommand } from "./commands/setup.js";
import { initCommand } from "./commands/init.js";
import { loginCommand } from "./commands/login.js";
import { ticketCommand } from "./commands/ticket.js";
import { ticketDoneCommand } from "./commands/ticket-done.js";
import { sprintCommand } from "./commands/sprint.js";
import { sprintReviewCommand } from "./commands/sprint-review.js";
import { mineCommand } from "./commands/mine.js";
import { moveCommand } from "./commands/move.js";
import { dailyReportCommand } from "./commands/daily-report.js";
import { configGetCommand } from "./commands/config-get.js";
import { runDoctor } from "./doctor.js";
import { runUpgrade } from "./upgrade.js";

export async function main(argv) {
  const args = argv.slice(2);
  if (args.length === 0 || args[0] === "--help" || args[0] === "-h") {
    printHelp();
    return 0;
  }
  if (args[0] === "--version" || args[0] === "-V") {
    const pkg = JSON.parse(await readFile(`${packageRoot()}/package.json`, "utf8"));
    console.log(pkg.version ?? "0.0.0");
    return 0;
  }

  const [command, ...rest] = args;

  try {
    if (command === "setup") return await setupCommand(rest);
    if (command === "init") return await initCommand(rest);
    if (command === "login") return await loginCommand();
    if (command === "doctor") {
      const report = await runDoctor();
      for (const line of report.ok) console.log(`ok: ${line}`);
      for (const line of report.issues) console.warn(`issue: ${line}`);
      return report.issues.length > 0 ? 1 : 0;
    }
    if (command === "upgrade") {
      const withMatt = rest.includes("--with-matt");
      const { notes } = await runUpgrade({ withMatt });
      for (const line of notes) console.log(line);
      return 0;
    }
    if (command === "config" && rest[0] === "get") return await configGetCommand(rest.slice(1));
    if (command === "ticket") return await ticketCommand(rest);
    if (command === "ticket-done") return await ticketDoneCommand(rest);
    if (command === "sprint") return rest[0] === "review" ? await sprintReviewCommand(rest.slice(1)) : await sprintCommand(rest);
    if (command === "sprint-review") return await sprintReviewCommand(rest);
    if (command === "mine") return await mineCommand(rest);
    if (command === "move") return await moveCommand(rest);
    if (command === "daily-report") return await dailyReportCommand(rest);
    console.error(`Unknown command: ${command}`);
    printHelp();
    return 1;
  } catch (error) {
    console.error(error.message ?? error);
    return 1;
  }
}

function printHelp() {
  console.log(`bluesurf — Blue Surf CLI

  bluesurf setup | init | login | doctor | upgrade [--with-matt]
  bluesurf config get <dot.key> [--cwd path]
  bluesurf ticket <CODE> | ticket-done <CODE> | sprint | sprint-review | mine | move | daily-report
  Use --cwd <path> on workstore-aware commands. Global flags: --project, --json, --yes, --all, --headed
`);
}