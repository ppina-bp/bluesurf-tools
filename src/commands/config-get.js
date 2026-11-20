import { getConfigValue } from "../config/merge.js";
import { loadMergedConfig } from "../config/load.js";
import { parseCommonArgs } from "../argv.js";

export async function configGetCommand(argv) {
  const key = argv[0];
  if (!key || key.startsWith("-")) {
    console.error("Usage: bluesurf config get <dot.key> [--cwd path]");
    return 1;
  }
  const { options } = parseCommonArgs(argv.slice(1));
  const { config } = await loadMergedConfig({
    cwd: options.cwd,
    projectCode: options.projectCode,
  });
  const value = getConfigValue(config, key);
  if (value === undefined) {
    console.error(`Unknown or unset config key: ${key}`);
    return 1;
  }
  if (typeof value === "object") {
    console.log(JSON.stringify(value));
  } else {
    console.log(String(value));
  }
  return 0;
}