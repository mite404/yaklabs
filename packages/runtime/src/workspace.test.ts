import { describe, expect, it } from "vitest";
import {
  closeLane,
  insertLane,
  laneIdSchema,
  lanesOf,
  latestMain,
  locate,
  moveLane,
  newCardLaneId,
  projectIdSchema,
  quoteFor,
  reopenLane,
  resizeLane,
  sidebarTree,
  threadIdSchema,
  threadLane,
  threadLaneId,
  titleFor,
  workspaceSchema,
  type Lane,
  type Place,
  type ThreadSummary,
  type Workspace,
} from "./workspace";

const t = (id: string) => threadIdSchema.parse(id);
const p = (id: string) => projectIdSchema.parse(id);
const at = (time: string) => `2026-09-21T${time}:00.000Z`;

function thread(id: string, place: Place, created: string, updated = created): ThreadSummary {
  return {
    id: t(id),
    title: id,
    place,
    createdAt: at(created),
    updatedAt: at(updated),
    preview: "",
    draft: "",
  };
}

const main = (projectId: string): Place => ({ kind: "main", projectId: p(projectId) });
const child = (parentId: string): Place => ({ kind: "child", parentId: t(parentId) });

const card: Lane = {
  id: laneIdSchema.parse("c-1"),
  width: null,
  kind: "card",
  card: { v: 1, kind: "catalog", payload: {} },
  title: "Card",
};

// Two projects. m1 has an open card lane and c1's lane; c2 and c3 are closed.
const ws: Workspace = {
  projects: [
    { id: p("store"), name: "Demo store", createdAt: at("09:00") },
    { id: p("desk"), name: "Service desk", createdAt: at("08:00") },
  ],
  threads: [
    thread("m1", main("store"), "09:01", "09:05"),
    thread("m2", main("store"), "09:02"),
    thread("c1", child("m1"), "09:03", "09:10"),
    thread("c2", child("m1"), "09:04"),
    thread("c3", child("m1"), "09:00"),
    thread("m3", main("desk"), "08:30", "09:20"),
  ],
  lanes: { [t("m1")]: [card, threadLane(t("c1"))], [t("m2")]: [], [t("m3")]: [] },
  shell: null,
  notifications: [],
};

const lanes = ["a", "b", "c"].map((id) => threadLane(t(id)));
const ids = (list: Lane[]) => list.map((lane) => lane.id);
const lane = (threadId: string) => threadLaneId(t(threadId));

describe("sidebarTree", () => {
  it("lists projects oldest first, mains newest first, children open then closed", () => {
    const tree = sidebarTree(ws).map(({ project, mains }) => ({
      project: project.id,
      mains: mains.map((node) => [node.main.id, ...node.children.map((each) => each.id)]),
    }));
    expect(tree).toEqual([
      { project: "desk", mains: [["m3"]] },
      { project: "store", mains: [["m2"], ["m1", "c1", "c3", "c2"]] },
    ]);
  });
});

describe("locate", () => {
  it.each([
    ["a main", "m1", { main: "m1", focus: null }],
    ["a child", "c2", { main: "m1", focus: "c2" }],
    ["an unknown id", "nope", undefined],
  ])("finds %s", (_, id, expected) => {
    expect(locate(ws, id)).toEqual(expected);
  });
});

describe("latestMain", () => {
  it("counts a child's activity as its main's", () => {
    const busier = { ...ws, threads: [...ws.threads, thread("c4", child("m1"), "09:30")] };
    expect(latestMain(ws)).toBe("m3");
    expect(latestMain(busier)).toBe("m1");
  });

  it("has nothing to open in an empty workspace", () => {
    expect(latestMain({ ...ws, threads: [] })).toBeUndefined();
  });
});

describe("lanesOf", () => {
  it("reads a main's lanes, and none for a child or an unknown id", () => {
    expect(ids(lanesOf(ws, t("m1")))).toEqual(["c-1", "l-c1"]);
    expect(lanesOf(ws, t("c1"))).toEqual([]);
    expect(lanesOf(ws, t("nope"))).toEqual([]);
  });
});

describe("lane edits are idempotent list edits", () => {
  const x = threadLane(t("x"));
  it.each<[string, (list: Lane[]) => Lane[], string[]]>([
    ["insert in the middle", (list) => insertLane(list, 1, x), ["l-a", "l-x", "l-b", "l-c"]],
    ["insert before the start", (list) => insertLane(list, -5, x), ["l-x", "l-a", "l-b", "l-c"]],
    ["insert past the end", (list) => insertLane(list, 99, x), ["l-a", "l-b", "l-c", "l-x"]],
    ["insert at NaN", (list) => insertLane(list, Number.NaN, x), ["l-a", "l-b", "l-c", "l-x"]],
    ["insert one it holds", (list) => insertLane(list, 0, lanes[2]), ["l-c", "l-a", "l-b"]],
    ["move to the start", (list) => moveLane(list, lane("c"), 0), ["l-c", "l-a", "l-b"]],
    ["move to the end", (list) => moveLane(list, lane("a"), 2), ["l-b", "l-c", "l-a"]],
    ["move a missing lane", (list) => moveLane(list, lane("x"), 0), ["l-a", "l-b", "l-c"]],
    ["close", (list) => closeLane(list, lane("b")), ["l-a", "l-c"]],
    ["close a missing lane", (list) => closeLane(list, lane("x")), ["l-a", "l-b", "l-c"]],
    ["reopen a closed thread", (list) => reopenLane(list, t("x")), ["l-a", "l-b", "l-c", "l-x"]],
    ["reopen an open thread", (list) => reopenLane(list, t("a")), ["l-a", "l-b", "l-c"]],
  ])("%s", (_, edit, expected) => {
    const once = edit(lanes);
    expect(ids(once)).toEqual(expected);
    expect(edit(once)).toEqual(once);
  });

  it.each<[string, number | null]>([
    ["sets a width", 320],
    ["puts the default back", null],
  ])("resize %s", (_, width) => {
    const once = resizeLane(lanes, lane("b"), width);
    expect(once.map((each) => each.width)).toEqual([null, width, null]);
    expect(resizeLane(once, lane("b"), width)).toEqual(once);
  });
});

describe("newCardLaneId", () => {
  it("mints a fresh card lane id each time", () => {
    const [first, second] = [newCardLaneId(), newCardLaneId()];
    expect(first).toMatch(/^c-[0-9a-f]{12}$/);
    expect(first).not.toBe(second);
  });
});

describe("workspaceSchema", () => {
  it("accepts the fixture and refuses a thread lane whose id is not l-<threadId>", () => {
    expect(workspaceSchema.parse(ws)).toEqual(ws);
    const stray = { ...threadLane(t("c1")), id: "l-c2" };
    const broken = { ...ws, lanes: { m1: [stray] } };
    expect(workspaceSchema.safeParse(broken).success).toBe(false);
  });
});

describe("titleFor", () => {
  it("keeps a short highlight whole, on one line", () => {
    expect(titleFor("Saturday leads\n  at every level")).toBe("Saturday leads at every level");
  });
  it("cuts a long highlight at a word and marks the cut", () => {
    const title = titleFor("The weekend carries the week because Saturday alone brings a third");
    expect(title).toBe("The weekend carries the week because Saturday…");
    expect(title.length).toBeLessThanOrEqual(49);
  });
});

describe("quoteFor", () => {
  it("quotes every line and leaves room to ask beneath", () => {
    expect(quoteFor("one\ntwo")).toBe("> one\n> two\n\n");
  });
});
