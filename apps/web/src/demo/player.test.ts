import type { AgentEvent } from "@yaklabs/catalog/agent";
import type { ThreadHandle } from "@yaklabs/catalog/thread";
import { describe, expect, it } from "vitest";
import type { Clock } from "./clock";
import { createPlayer, cuesOf, type Player } from "./player";
import { createDemoRuntime, type DemoRuntime } from "./runtime";
import { at, type Beat, type Script } from "./script";
import { scriptFor, userBeats } from "./scripts";

// A clock on which every wait is over after one turn of the event loop; `before` sees each.
function clockThat(before: (ms: number) => void = () => {}): Clock {
  return {
    state: () => ({ rate: 1, paused: false }),
    subscribe: () => () => {},
    wait: async (ms) => {
      before(ms);
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
    },
    setRate: () => {},
    pause: () => {},
    resume: () => {},
  };
}

// A stand-in for the thread panel: it sends what its handle is told to the runtime's agent, as
// the panel would, and notes each call.
function fakePanel(runtime: DemoRuntime): { handle: ThreadHandle; calls: string[] } {
  const calls: string[] = [];
  const live = new Set<AbortController>();
  let draft = "";
  const tell = (event: AgentEvent) => {
    const stop = new AbortController();
    live.add(stop);
    void (async () => {
      const chunks = [];
      for await (const chunk of runtime.agent(runtime.main).respond(event, stop.signal)) {
        if (stop.signal.aborted) break;
        chunks.push(chunk);
      }
      live.delete(stop);
    })();
  };
  const handle: ThreadHandle = {
    setDraft: (text) => {
      draft = text;
    },
    send: () => {
      calls.push(`send ${draft}`);
      tell({ kind: "message", text: draft, attachments: [] });
      draft = "";
    },
    answer: (text) => {
      calls.push(`answer ${text}`);
      tell({ kind: "answer", text });
    },
    stop: () => {
      calls.push("stop");
      for (const each of live) each.abort();
    },
    retry: () => {
      calls.push("retry");
      tell({ kind: "message", text: "again", attachments: [] });
    },
  };
  return { handle, calls };
}

// Resolves once the player is done.
function finished(player: Player): Promise<void> {
  return new Promise((resolve) => {
    const check = () => {
      if (player.state().status === "done") resolve();
    };
    player.subscribe(check);
    check();
  });
}

// What the fake panel notes for one user beat.
function noted(beat: Beat): string {
  if (beat.kind === "user" || beat.kind === "answer")
    return `${beat.kind === "user" ? "send" : "answer"} ${beat.text}`;
  return beat.kind;
}

// The presenter answering the docked question before the player's 777ms pause is over.
function presenterAnswersFirst(panel: ThreadHandle): Clock {
  let answered = false;
  return clockThat((ms) => {
    if (ms !== 777 || answered) return;
    answered = true;
    panel.answer("Billing first");
  });
}

describe("the demo player", () => {
  it("waits on the reply before each beat, or counts from the beat before it", () => {
    expect(
      cuesOf(scriptFor("background").beats).map((cue) => [cue.beat.kind, cue.settles]),
    ).toEqual([
      ["user", null],
      ["user", null],
      ["stop", 1],
      ["user", null],
    ]);
    expect(cuesOf(scriptFor("brief").beats).map((cue) => cue.settles)).toEqual([null, 0]);
  });

  it.each(["brief", "interrupted", "background"])(
    "performs every user beat of %s through the panel, in order, and ends done",
    async (id) => {
      const script = scriptFor(id);
      const runtime = createDemoRuntime(script, clockThat());
      const panel = fakePanel(runtime);
      const player = createPlayer({
        script,
        runtime,
        clock: clockThat(),
        panels: new Map([[runtime.main, panel.handle]]),
      });
      expect(player.state().status).toBe("idle");
      player.play();
      await finished(player);
      expect(panel.calls).toEqual(userBeats(script).map((beat) => noted(beat)));
      expect(runtime.progress().settled.size).toBe(runtime.progress().started);
    },
  );
});

describe("the demo player and the presenter", () => {
  it("does not answer again when the presenter answered first", async () => {
    const script: Script = {
      ...scriptFor("brief"),
      beats: [
        { kind: "user", after: 0, text: "Draft it" },
        { kind: "reply", events: [at(0, "Which order?")] },
        { kind: "answer", after: 777, text: "Oldest first" },
        { kind: "reply", events: [at(0, "Done.")] },
      ],
    };
    const runtime = createDemoRuntime(script, clockThat());
    const panel = fakePanel(runtime);
    const clock = presenterAnswersFirst(panel.handle);
    const player = createPlayer({
      script,
      runtime,
      clock,
      panels: new Map([[runtime.main, panel.handle]]),
    });
    player.play();
    await finished(player);
    expect(panel.calls).toEqual(["send Draft it", "answer Billing first"]);
  });
});

describe("the demo player's time", () => {
  it("pauses the clock with it, and counts only the time it played", () => {
    let wall = 1_000;
    const paused: boolean[] = [];
    const clock = {
      ...clockThat(),
      pause: () => paused.push(true),
      resume: () => paused.push(false),
    };
    const script = scriptFor("brief");
    const runtime = createDemoRuntime(script, clock);
    const player = createPlayer({ script, runtime, clock, panels: new Map(), now: () => wall });
    player.play();
    wall += 400;
    player.pause();
    wall += 5_000;
    expect(player.state().status).toBe("paused");
    expect(player.elapsed()).toBe(400);
    player.play();
    wall += 100;
    expect(player.elapsed()).toBe(500);
    expect(paused).toEqual([true, false]);
    player.dispose();
  });
});
