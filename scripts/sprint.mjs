import { main } from "../src/cli.js";

await main(["node", "bluesurf", "sprint", ...process.argv.slice(2)]);