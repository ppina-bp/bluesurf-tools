import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../src/env.js";
import { parseTicketKey } from "../src/model.js";
import { createSessionClient } from "../src/session.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadEnvFile(path.join(root, ".env"));

const args = process.argv.slice(2);
const yes = args.includes("--yes");
const [code, ...statusWords] = args.filter((arg) => arg !== "--yes");
const statusQuery = statusWords.join(" ");
if (!code || !statusQuery) {
  console.error('Usage: npm run move -- RLD-388 "Development (DONE)" [--yes]');
  process.exit(1);
}
parseTicketKey(code);

const headless = process.env.BLUESURF_HEADED !== "1";
const client = await createSessionClient({
  origin: process.env.BLUESURF_ORIGIN,
  headless,
});

try {
  const plan = await client.planMove(code, statusQuery);
  if (plan.unchanged) {
    console.log(`${code} is already in ${plan.to}. Nothing to do.`);
  } else if (!yes) {
    console.log(`Would move ${code}: ${plan.from} → ${plan.to}`);
    console.log("Nothing changed. Re-run with --yes to move it.");
  } else {
    const updated = await client.moveWorkItem(plan);
    console.log(`Moved ${code}: ${plan.from} → ${updated.statusName}`);
    try {
      await client.notifyProjectUpdated(plan.projectCode, plan.workItemId);
    } catch (error) {
      console.log(`(Board refresh notice not sent: ${error.message}. Teammates see it on reload.)`);
    }
  }
} finally {
  await client.close();
}
