import { parseCommonArgs } from "../argv.js";
import { loadRuntimeContext } from "../runtime-context.js";
import { exportTicket } from "../export-ticket.js";
import { createSessionClient } from "../session.js";
import { parseTicketKey } from "../model.js";

export async function ticketCommand(argv) {
  const { options, positional } = parseCommonArgs(argv);
  const code = positional.find((a) => !a.startsWith("-"));
  if (!code) {
    console.error("Usage: bluesurf ticket <CODE> [--cwd path]");
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
    const result = await exportTicket({
      client,
      vault: ctx.vault,
      code,
      downloadAttachments: ctx.config.pull?.download_attachments !== false,
      descriptionFormat: ctx.config.ticket?.description ?? "html",
      bugsDetectedTag: ctx.config.ticket?.bugs_detected_tag ?? "Bugs Detected",
    });
    console.log(`Wrote ${result.notePath}`);
    if (result.attachments.length === 0) console.log("No attachments.");
    for (const file of result.attachments) console.log(`Wrote ${file}`);
    return 0;
  } finally {
    await client.close();
  }
}