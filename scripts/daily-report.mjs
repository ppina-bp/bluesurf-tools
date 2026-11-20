import { main } from "../src/cli.js";

await main(["node", "bluesurf", "daily-report", ...process.argv.slice(2)]);