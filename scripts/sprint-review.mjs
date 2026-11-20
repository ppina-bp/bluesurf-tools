import { main } from "../src/cli.js";

await main(["node", "bluesurf", "sprint-review", ...process.argv.slice(2)]);