import { parseCommonArgs } from "../argv.js";
import { loadRuntimeContext } from "../runtime-context.js";
import { formatMyTickets, groupMyTickets } from "../model.js";
import { createSessionClient } from "../session.js";

export async function mineCommand(argv) {
  const { options } = parseCommonArgs(argv);
  const ctx = await loadRuntimeContext({ cwd: options.cwd, projectCode: options.projectCode });
  const useAll = options.all ?? ctx.config.mine?.include_done ?? false;
  const client = await createSessionClient({
    origin: ctx.origin,
    headless: options.headless,
    session: ctx.session,
  });
  try {
    const groups = groupMyTickets(await client.listMyWorkItems(ctx.projectCode), { all: useAll });
    if (options.json) {
      console.log(JSON.stringify(groups, null, 2));
    } else if (groups.length === 0) {
      console.log(
        useAll ? "No tickets assigned to you." : "No open tickets assigned to you. Use --all to include DONE.",
      );
    } else {
      console.log(formatMyTickets(groups));
    }
    return 0;
  } finally {
    await client.close();
  }
}