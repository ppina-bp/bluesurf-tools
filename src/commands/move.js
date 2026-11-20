import { parseCommonArgs } from "../argv.js";
import { loadRuntimeContext } from "../runtime-context.js";
import { parseTicketKey } from "../model.js";
import { createSessionClient } from "../session.js";

export async function moveCommand(argv) {
  const { options, positional } = parseCommonArgs(argv);
  const filtered = positional.filter((a) => a !== "--yes");
  const [code, ...statusWords] = filtered;
  const statusQuery = statusWords.join(" ");
  if (!code || !statusQuery) {
    console.error('Usage: bluesurf move <CODE> "<status name>" [--yes] [--cwd path]');
    return 1;
  }
  parseTicketKey(code);
  const ctx = await loadRuntimeContext({ cwd: options.cwd, projectCode: options.projectCode });
  const client = await createSessionClient({
    origin: ctx.origin,
    headless: options.headless,
    session: ctx.session,
  });
  try {
    const plan = await client.planMove(code, statusQuery);
    if (plan.unchanged) {
      console.log(`${code} is already in ${plan.to}. Nothing to do.`);
    } else if (!options.yes) {
      console.log(`Would move ${code}: ${plan.from} → ${plan.to}`);
      console.log("Nothing changed. Re-run with --yes to move it.");
    } else {
      const updated = await client.moveWorkItem(plan);
      console.log(`Moved ${code}: ${plan.from} → ${updated.statusName}`);
      try {
        await client.notifyProjectUpdated(plan.projectCode, plan.workItemId);
      } catch (error) {
        console.log(`(Board refresh notice not sent: ${error.message}. Teammates see it on reload.)`);
      }
    }
    return 0;
  } finally {
    await client.close();
  }
}