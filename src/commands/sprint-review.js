import { parseCommonArgs } from "../argv.js";
import { loadRuntimeContext } from "../runtime-context.js";
import { exportSprintReview } from "../export-sprint-review.js";
import { createSessionClient } from "../session.js";

export async function sprintReviewCommand(argv) {
  const { options, positional } = parseCommonArgs(argv);
  let sprintNumber;
  for (let i = 0; i < positional.length; i++) {
    if (positional[i] === "--sprint" && positional[i + 1]) {
      sprintNumber = Number(positional[++i]);
      continue;
    }
    if (!positional[i].startsWith("-") && sprintNumber === undefined && /^\d+$/.test(positional[i])) {
      sprintNumber = Number(positional[i]);
    }
  }
  if (sprintNumber !== undefined && Number.isNaN(sprintNumber)) {
    console.error("Invalid sprint number");
    return 1;
  }
  const ctx = await loadRuntimeContext({ cwd: options.cwd, projectCode: options.projectCode });
  const client = await createSessionClient({
    origin: ctx.origin,
    headless: options.headless,
    session: ctx.session,
  });
  try {
    const result = await exportSprintReview({
      client,
      vault: ctx.vault,
      projectCode: ctx.projectCode,
      sprintNumber,
      sort: ctx.config.sprint?.sort ?? "priority",
    });
    if (result.notePath) console.log(`Wrote ${result.notePath}`);
    else console.log(result.message ?? "No sprint review note written.");
    return 0;
  } finally {
    await client.close();
  }
}