import { main } from "../src/cli.js";

await main(["node", "bluesurf", "ticket-done", ...process.argv.slice(2)]);