import type { RuntimeState } from "@yaklabs/runtime";
import { useRuntimeState } from "../runtime";
import { useScripted } from "./provider";

/** What a thread's dictation hears: the visitor's microphone, or a simulated recording. */
export type DictationSource = "microphone" | "simulated";

/**
 * How a thread hears dictation. The device's own threads, the Live Playground's among them,
 * listen to the visitor's microphone (Ethan); a thread the Demo holds, and every thread of a
 * scenario, plays a simulated recording, so a scripted take or a fixture sounds the same every
 * time. Until the runtime is ready it is simulated, since its source is not known yet.
 * @param scripted Whether the Demo holds the thread.
 */
export function dictationOf(state: RuntimeState, scripted: boolean): DictationSource {
  const onDevice = state.kind === "ready" && state.source.kind === "device";
  return onDevice && !scripted ? "microphone" : "simulated";
}

/** How the thread `id` hears dictation (`dictationOf`), as the panel's `dictation` prop. */
export function useDictation(id: string): { source: DictationSource } {
  return { source: dictationOf(useRuntimeState(), useScripted(id)) };
}
