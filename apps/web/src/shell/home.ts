import { STARTER, type ProjectId, type Workspace } from "@yaklabs/runtime";

/**
 * Where a new thread goes when nothing names a project: the Live Playground, which the live
 * model answers (ADR-156), rather than whichever project the sidebar lists first, which may be
 * the scripted Demo's; undefined on a source with no Live Playground (a scenario).
 */
export function liveProjectOf(ws: Workspace): ProjectId | undefined {
  return ws.projects.find((project) => project.id === STARTER.project.id)?.id;
}
