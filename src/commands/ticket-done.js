import { parseTicketKey } from "../model.js";
import { loadRuntimeContext } from "../runtime-context.js";
import { parseCommonArgs } from "../argv.js";

export async function ticketDoneCommand(argv) {
  const { options, positional } = parseCommonArgs(argv);
  const code = positional.find((a) => !a.startsWith("-"));
  if (!code) {
    console.error("Usage: bluesurf ticket-done <CODE> [--cwd path]");
    return 1;
  }
  parseTicketKey(code);
  const ctx = await loadRuntimeContext({ cwd: options.cwd, projectCode: options.projectCode });
  const deleteFolder = ctx.config.ticket?.done?.delete_folder !== false;
  if (!deleteFolder) {
    console.log(`Ticket ${code} complete (workstore folder kept).`);
    return 0;
  }
  const removed = await ctx.vault.removeTicket(code);
  console.log(`Removed ${removed}`);
  return 0;
}