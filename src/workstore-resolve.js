import path from "node:path";
import { localWorkstoreRoot } from "./paths.js";

/**
 * Resolve workstore root and layout dirs from merged config and cwd.
 */
export function resolveWorkstore({ config, cwd, projectRoot, home }) {
  const kind = config.workstore?.kind ?? "path";
  const layout = {
    tickets: config.workstore?.layout?.tickets ?? "Tickets",
    sprints: config.workstore?.layout?.sprints ?? "Sprints",
  };
  const projectCode = config.surf?.project_code ?? "RLD";

  let root;
  let repoRoot = projectRoot;

  if (kind === "local") {
    root = localWorkstoreRoot(projectCode, home);
  } else if (kind === "repo") {
    repoRoot = projectRoot ?? path.resolve(cwd);
    const rel = config.workstore?.root?.trim() || ".bluesurf";
    root = path.resolve(repoRoot, rel);
  } else {
    const configured = config.workstore?.root?.trim();
    if (!configured) {
      throw new Error(
        "Workstore root is not set. Run bluesurf setup or set [workstore].root in ~/.config/bluesurf/config.toml",
      );
    }
    root = path.resolve(configured);
  }

  return {
    kind,
    root,
    ticketsDir: layout.tickets,
    sprintsDir: layout.sprints,
    repoRoot,
    projectCode,
  };
}