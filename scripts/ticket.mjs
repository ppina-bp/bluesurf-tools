import { main } from "../src/cli.js";

await main(["node", "bluesurf", "ticket", ...process.argv.slice(2)]);