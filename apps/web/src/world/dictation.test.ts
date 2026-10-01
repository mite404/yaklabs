import type { RuntimeState, Workspace } from "@yaklabs/runtime";
import { describe, expect, it } from "vitest";
import { dictationOf } from "./dictation";

const workspace: Workspace = {
  projects: [],
  threads: [],
  lanes: {},
  shell: null,
  notifications: [],
  shares: [],
};
const onDevice: RuntimeState = {
  kind: "ready",
  source: { kind: "device", storage: "opfs" },
  workspace,
  replying: [],
};
const inScenario: RuntimeState = {
  kind: "ready",
  source: { kind: "scenario", name: "demo" },
  workspace,
  replying: [],
};

describe("dictationOf", () => {
  it("listens to the microphone in the device's own threads", () => {
    expect(dictationOf(onDevice, false)).toBe("microphone");
  });

  it("plays the simulated recording in the Demo's threads and a scenario's", () => {
    expect(dictationOf(onDevice, true)).toBe("simulated");
    expect(dictationOf(inScenario, false)).toBe("simulated");
  });

  it("plays the simulated recording until the runtime is ready", () => {
    expect(dictationOf({ kind: "starting", source: null }, false)).toBe("simulated");
  });
});
