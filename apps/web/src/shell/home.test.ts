import {
  STARTER,
  threadIdSchema,
  type ProjectId,
  type ThreadId,
  type ThreadSummary,
  type Workspace,
} from "@yaklabs/runtime";
import { describe, expect, it } from "vitest";
import { liveProjectOf } from "./home";

// The runtime keeps its project id schema to itself; a test id is one cast.
// oxlint-disable-next-line typescript/no-unsafe-type-assertion -- a fixture id, never parsed from outside
const DEMO = "demo" as ProjectId;
const LIVE = STARTER.project.id;
const id = (raw: string): ThreadId => threadIdSchema.parse(raw);
const BRIEF = id("brief");

// A main in `projectId`, made at `createdAt`, holding `turnCount` turns.
function main(
  threadId: ThreadId,
  projectId: ProjectId,
  createdAt: string,
  turnCount = 0,
): ThreadSummary {
  return {
    id: threadId,
    title: threadId,
    place: { kind: "main", projectId },
    createdAt,
    updatedAt: createdAt,
    preview: "",
    turnCount,
    draft: "",
    pinnedAt: null,
    snoozedUntil: null,
    archivedAt: null,
  };
}

// The Demo first, as the sidebar lists it, and the Live Playground with the threads given.
function workspace(threads: ThreadSummary[], live = true): Workspace {
  const at = "2026-09-20T09:00:00.000Z";
  return {
    projects: [
      { id: DEMO, name: "Demo", createdAt: at },
      ...(live ? [{ id: LIVE, name: STARTER.project.name, createdAt: at }] : []),
    ],
    threads: [main(BRIEF, DEMO, at, 4), ...threads],
    lanes: {},
    shell: null,
    notifications: [],
    shares: [],
  };
}

const STARTED = main(STARTER.thread.id, LIVE, "2026-09-20T09:00:00.000Z");

describe("liveProjectOf", () => {
  it("names the Live Playground, not the project the sidebar lists first", () => {
    expect(liveProjectOf(workspace([STARTED]))).toBe(LIVE);
  });

  it("names none on a source without one", () => {
    expect(liveProjectOf(workspace([], false))).toBeUndefined();
  });
});
