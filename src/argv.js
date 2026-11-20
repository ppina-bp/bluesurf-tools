/** Parse shared CLI flags; leaves positional args without flags. */
export function parseCommonArgs(argv) {
  const options = {
    cwd: process.cwd(),
    projectCode: undefined,
    json: false,
    headless: process.env.BLUESURF_HEADED !== "1",
    yes: false,
  };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--cwd" && argv[i + 1]) {
      options.cwd = argv[++i];
      continue;
    }
    if (arg === "--project" && argv[i + 1]) {
      options.projectCode = argv[++i];
      continue;
    }
    if (arg === "--json") {
      options.json = true;
      continue;
    }
    if (arg === "--headed") {
      options.headless = false;
      continue;
    }
    if (arg === "--yes") {
      options.yes = true;
      continue;
    }
    if (arg === "--all") {
      options.all = true;
      continue;
    }
    if (arg.startsWith("-")) {
      positional.push(arg);
      continue;
    }
    positional.push(arg);
  }
  return { options, positional };
}