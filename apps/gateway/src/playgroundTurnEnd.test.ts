import { afterEach, describe, expect, it, vi } from "vitest";
import { eventsFor, rawRound, round, text, tool } from "./playgroundTestKit";

const running = { workId: "sum", label: "Adding up the week", status: "running" };
const failure = (limitation: string) => ({
  type: "failure",
  workId: null,
  limitation,
  recovery: null,
});
const noResponse = failure("The model stopped responding.");
const emptyAnswer = failure("I finished without an answer.");

afterEach(() => {
  vi.restoreAllMocks();
});

describe("a turn never ends silently", () => {
  it("when the reply answers with nothing to show", async () => {
    const { events } = await eventsFor("Which day?", round("end_turn", text(0, " ")));

    expect(events).toEqual([emptyAnswer, { type: "end", reason: "upstream" }]);
  });

  it("when every line of text was narration for work", async () => {
    const first = round(
      "tool_use",
      text(0, "Adding Monday to Friday."),
      tool(1, "update_work", running),
    );

    const { events } = await eventsFor("Chart it.", first, round("end_turn"));

    expect(events.slice(-2)).toEqual([emptyAnswer, { type: "end", reason: "upstream" }]);
  });

  it("and adds nothing to a reply that answered", async () => {
    const { events } = await eventsFor("Which day?", round("end_turn", text(0, "Friday.")));

    expect(events.map(({ type }) => type)).toEqual(["text", "end"]);
  });
});

describe("a round that breaks", () => {
  it("for a reason other than the upstream is logged, and still ends the turn", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const garbled = rawRound("event: message_start\ndata: {not json\n\n");

    const { events } = await eventsFor("Which day?", garbled);

    expect(events).toEqual([noResponse, { type: "end", reason: "upstream" }]);
    expect(logged).toHaveBeenCalledWith("[playground] round failed:", expect.any(SyntaxError));
  });

  it("because the upstream sent an error is not logged", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => {});
    const busy = rawRound(
      'event: error\ndata: {"type":"error","error":{"type":"overloaded_error","message":"Busy"}}\n\n',
    );

    const { events } = await eventsFor("Which day?", busy);

    expect(events).toEqual([noResponse, { type: "end", reason: "upstream" }]);
    expect(logged).not.toHaveBeenCalled();
  });
});
