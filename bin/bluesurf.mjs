#!/usr/bin/env node
import { main } from "../src/cli.js";

const code = await main(process.argv);
process.exitCode = code ?? 0;