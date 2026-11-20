import { main } from "../src/cli.js";

await main(["node", "bluesurf", "mine", ...process.argv.slice(2)]);