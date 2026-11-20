import { parseTicketKey } from "./model.js";

export async function exportTicket({
  client,
  vault,
  code,
  downloadAttachments = true,
  descriptionFormat = "html",
  bugsDetectedTag = "Bugs Detected",
}) {
  parseTicketKey(code);
  const note = await client.getTicketNote(code, { descriptionFormat, bugsDetectedTag });
  const attachments = [];
  if (downloadAttachments) {
    const files = await client.listWorkItemFiles(code);
    for (const file of files) {
      const bytes = await client.downloadWorkItemFile(file.workItemId, file.id);
      attachments.push(await vault.writeAttachment(code, file.name, bytes));
    }
  }
  const notePath = await vault.writeNote(code, note);
  return { notePath, attachments };
}
