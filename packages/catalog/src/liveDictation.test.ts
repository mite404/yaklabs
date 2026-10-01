import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  defaultLabel,
  heardSoFar,
  SILENT_SPEECH,
  speechFailure,
  transcribe,
  type SpeechRecognizerClass,
} from "./liveDictation";

// A speech service the test plays by hand: each start is counted, and the test fires its
// events as a browser would. Every event carries both fields, so one listener type takes
// whichever a handler reads.
type SpeechEvent = { results: ArrayLike<ArrayLike<{ transcript: string }>>; error: string };
type Listener = (event: SpeechEvent) => void;
const NOTHING: SpeechEvent = { results: [], error: "" };

function fakeService() {
  const listeners = new Map<string, Listener[]>();
  const calls = { start: 0, stop: 0 };
  const emit = (type: string, event: Partial<SpeechEvent> = {}) => {
    for (const listener of listeners.get(type) ?? []) listener({ ...NOTHING, ...event });
  };
  const Recognizer: SpeechRecognizerClass = class {
    continuous = false;
    interimResults = false;
    lang = "";
    addEventListener(type: string, listener: Listener) {
      listeners.set(type, [...(listeners.get(type) ?? []), listener]);
    }
    start() {
      calls.start += 1;
    }
    stop() {
      calls.stop += 1;
    }
  };
  const said = (...words: string[]) => {
    emit("result", { results: words.map((transcript) => [{ transcript }]) });
  };
  return { Recognizer, emit, said, calls };
}

function listen(service: ReturnType<typeof fakeService>) {
  const heard: string[] = [];
  const failures: string[] = [];
  const silences = { count: 0 };
  const stop = transcribe(service.Recognizer, {
    onText: (text) => {
      heard.push(text);
    },
    onFailure: (message) => {
      failures.push(message);
    },
    onSilence: () => {
      silences.count += 1;
    },
  });
  return { heard, failures, silences, stop };
}

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("transcribe keeps listening through the speech service's pauses", () => {
  it("reports the words so far, and keeps them when Chrome ends a session after a pause", () => {
    const service = fakeService();
    const { heard, failures } = listen(service);
    service.emit("start");
    service.said("Check last", " week's refunds");
    service.emit("end");
    expect(service.calls.start).toBe(2);
    service.emit("start");
    service.said("against their orders");
    expect(heard.at(-1)).toBe("Check last week's refunds against their orders");
    expect(failures).toEqual([]);
  });

  it("gets over a stretch of silence, and stops when asked without restarting", () => {
    const service = fakeService();
    const { failures, silences, stop } = listen(service);
    service.emit("start");
    service.emit("error", { error: "no-speech" });
    expect(silences.count).toBe(1);
    stop();
    service.emit("error", { error: "aborted" });
    service.emit("end");
    expect(service.calls).toEqual({ start: 1, stop: 1 });
    expect(failures).toEqual([]);
  });
});

describe("transcribe says when the speech service fails, since the waveform cannot", () => {
  it("names a failure in words and stops trying", () => {
    const service = fakeService();
    const { failures } = listen(service);
    service.emit("start");
    service.emit("error", { error: "network" });
    service.emit("end");
    expect(service.calls.start).toBe(1);
    expect(failures).toEqual([speechFailure("network")]);
  });

  it("says so when the service never answers a start", () => {
    const service = fakeService();
    const { failures } = listen(service);
    vi.advanceTimersByTime(4000);
    expect(failures).toEqual([SILENT_SPEECH]);
  });

  it("says so once when a session ends without starting, rather than restarting forever", () => {
    const service = fakeService();
    const { failures } = listen(service);
    service.emit("end");
    vi.advanceTimersByTime(4000);
    expect(service.calls.start).toBe(1);
    expect(failures).toEqual([SILENT_SPEECH]);
  });
});

describe("speechFailure and heardSoFar", () => {
  it("passes over silence and the page's own stop, and words every other error", () => {
    expect(speechFailure("no-speech")).toBeUndefined();
    expect(speechFailure("aborted")).toBeUndefined();
    expect(speechFailure("not-allowed")).toMatch(/blocked/);
    expect(speechFailure("bad-grammar")).toBe(
      "Speech recognition failed (bad-grammar), so no text will appear.",
    );
  });

  it("joins the sessions' words with one space, skipping empty ones", () => {
    expect(heardSoFar("", " hello ")).toBe("hello");
    expect(heardSoFar("hello", "")).toBe("hello");
    expect(heardSoFar("hello", "there")).toBe("hello there");
  });
});

describe("defaultLabel names the device the system's default is", () => {
  it("takes the device from the browser's label, and stands alone without one", () => {
    expect(defaultLabel("Default - MacBook Pro Microphone (Built-in)")).toBe(
      "System Default (MacBook Pro Microphone (Built-in))",
    );
    expect(defaultLabel("")).toBe("System Default");
  });
});
