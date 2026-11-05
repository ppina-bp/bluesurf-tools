import path from "node:path";
import { fileURLToPath } from "node:url";
import { loadEnvFile } from "../src/env.js";
import { formatMyTickets, groupMyTickets } from "../src/model.js";
import { createSessionClient } from "../src/session.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
await loadEnvFile(path.join(root, ".env"));

const args = process.argv.slice(2);
const all = args.includes("--all");
const json = args.includes("--json");
const projectCode = args.find((arg) => !arg.startsWith("--")) ?? process.env.BLUESURF_PROJECT ?? "RLD";

const headless = process.env.BLUESURF_HEADED !== "1";
const client = await createSessionClient({
  origin: process.env.BLUESURF_ORIGIN,
  headless,
});

try {
  const groups = groupMyTickets(await client.listMyWorkItems(projectCode), { all });
  if (json) {
    console.log(JSON.stringify(groups, null, 2));
  } else if (groups.length === 0) {
    console.log(all ? "No tickets assigned to you." : "No open tickets assigned to you. Use --all to include Validation (DONE).");
  } else {
    console.log(formatMyTickets(groups));
  }
} finally {
  await client.close();
}
