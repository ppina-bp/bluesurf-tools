import { main } from "../src/cli.js";

await main(["node", "bluesurf", "move", ...process.argv.slice(2)]);