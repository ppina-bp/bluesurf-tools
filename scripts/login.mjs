import { main } from "../src/cli.js";

const code = await main(["node", "bluesurf", "login"]);
process.exitCode = code ?? 0;