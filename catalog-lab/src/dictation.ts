/** A capture device the user can choose, as the browser reports it. */
export type AudioDevice = { id: string; label: string };

/** Fixture devices so the picker is testable without microphone permission. */
export const SIMULATED_DEVICES: AudioDevice[] = [
  { id: "default", label: "System Default" },
  { id: "builtin", label: "MacBook Pro Microphone" },
  { id: "usb", label: "USB Headset Microphone" },
  { id: "loopback", label: "Loopback Audio" },
];

// The phrase the simulated source "speaks", one word per WORD_MS of speech.
const SIMULATED_WORDS =
  "Can you compare this week's closed cases with last week and flag anything unusual?".split(" ");
const WORD_MS = 340;
// Speech arrives in phrases separated by short pauses, like a person thinking.
const PHRASE_MS = 2600;
const PAUSE_MS = 450;

/**
 * A deterministic, speech-like input level between 0 and 1 for a moment in a
 * simulated recording: syllable pulses inside phrases, near-silence in pauses.
 */
export function simulatedLevel(elapsedMs: number): number {
  const inPhrase = elapsedMs % PHRASE_MS;
  if (inPhrase > PHRASE_MS - PAUSE_MS) return 0.03;
  const syllables = Math.abs(Math.sin(elapsedMs / 55) * Math.sin(elapsedMs / 163 + 1.3));
  const breath = 0.55 + 0.45 * Math.sin(elapsedMs / 900);
  return Math.min(1, 0.08 + 0.85 * syllables * breath);
}

/** The simulated transcript heard so far, revealed word by word during speech. */
export function simulatedTranscript(elapsedMs: number): string {
  const phrases = Math.floor(elapsedMs / PHRASE_MS);
  const inPhrase = Math.min(elapsedMs % PHRASE_MS, PHRASE_MS - PAUSE_MS);
  const speakingMs = phrases * (PHRASE_MS - PAUSE_MS) + inPhrase;
  return SIMULATED_WORDS.slice(0, Math.floor(speakingMs / WORD_MS)).join(" ");
}

/** Formats recording time as m:ss, e.g. "0:07" or "12:40". */
export function formatElapsed(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/** Converts a block of time-domain samples into a 0-1 loudness level (scaled RMS). */
export function levelFromSamples(samples: Float32Array): number {
  let sum = 0;
  for (const sample of samples) sum += sample * sample;
  return Math.min(1, Math.sqrt(sum / samples.length) * 4);
}

/**
 * Joins transcript text onto an existing draft with exactly one space between them,
 * so inserting dictation never glues words together or doubles spaces.
 */
export function appendDictation(draft: string, transcript: string): string {
  const spoken = transcript.trim();
  if (!spoken) return draft;
  return draft.trim() ? `${draft.trimEnd()} ${spoken}` : spoken;
}
