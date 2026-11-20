import { parseCommonArgs } from "../argv.js";
import { loadRuntimeContext } from "../runtime-context.js";
import { exportSprint } from "../export-sprint.js";
import { createSessionClient } from "../session.js";

export async function sprintCommand(argv) {
  const { options } = parseCommonArgs(argv);
  const ctx = await loadRuntimeContext({ cwd: options.cwd, projectCode: options.projectCode });
  const client = await createSessionClient({
    origin: ctx.origin,
    headless: options.headless,
    session: ctx.session,
  });
  try {
    const result = await exportSprint({
      client,
      vault: ctx.vault,
      projectCode: ctx.projectCode,
      sort: ctx.config.sprint?.sort ?? "priority",
    });
    console.log(`Wrote ${result.notePath}`);
    return 0;
  } finally {
    await client.close();
  }
}