import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  SIMULATED_DEVICES,
  formatElapsed,
  levelFromSamples,
  simulatedLevel,
  simulatedTranscript,
  type AudioDevice,
} from "./dictation";
import { Modal } from "./Modal";
import { Waveform } from "./Waveform";
import "./dictation.css";

/** Where audio comes from: a deterministic simulation, or the user's real microphone. */
export type DictationSource = "simulated" | "microphone";

// Minimal Web Speech API surface; it is not in TypeScript's DOM library.
type SpeechResultList = ArrayLike<ArrayLike<{ transcript: string }>>;
type SpeechRecognizer = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: { results: SpeechResultList }) => void) | null;
  start: () => void;
  stop: () => void;
};
type SpeechWindow = Window & {
  SpeechRecognition?: new () => SpeechRecognizer;
  webkitSpeechRecognition?: new () => SpeechRecognizer;
};

// How often the visible timer and simulated transcript refresh.
const CLOCK_MS = 250;

// Live input: a real microphone stream measured by an AnalyserNode.
function useMicrophone(enabled: boolean, deviceId: string) {
  const level = useRef(0);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!enabled) return;
    let stopped = false;
    let frame = 0;
    let stream: MediaStream | undefined;
    let context: AudioContext | undefined;
    navigator.mediaDevices
      .getUserMedia({ audio: deviceId === "default" ? true : { deviceId: { exact: deviceId } } })
      .then(async (granted) => {
        if (stopped) return granted.getTracks().forEach((track) => track.stop());
        stream = granted;
        context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaStreamSource(granted).connect(analyser);
        const samples = new Float32Array(analyser.fftSize);
        const measure = () => {
          analyser.getFloatTimeDomainData(samples);
          level.current = levelFromSamples(samples);
          frame = requestAnimationFrame(measure);
        };
        measure();
        const all = await navigator.mediaDevices.enumerateDevices();
        const inputs = all.filter((device) => device.kind === "audioinput");
        setDevices(
          inputs.map((device, index) => ({
            id: device.deviceId,
            label:
              device.deviceId === "default"
                ? "System Default"
                : device.label || `Microphone ${index + 1}`,
          })),
        );
      })
      .catch((reason: Error) =>
        setError(
          reason.name === "NotAllowedError"
            ? "Microphone access was blocked. Allow it in your browser settings to dictate."
            : "No microphone could be opened.",
        ),
      );
    return () => {
      stopped = true;
      cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      void context?.close();
    };
  }, [enabled, deviceId]);

  return { read: () => level.current, devices, error };
}

// Live transcription through the browser's speech service, where one exists.
function useSpeechTranscript(enabled: boolean) {
  const [text, setText] = useState("");
  const Recognizer =
    (window as SpeechWindow).SpeechRecognition ?? (window as SpeechWindow).webkitSpeechRecognition;
  const supported = Recognizer !== undefined;

  useEffect(() => {
    if (!enabled || !Recognizer) return;
    const recognizer = new Recognizer();
    recognizer.continuous = true;
    recognizer.interimResults = true;
    recognizer.lang = navigator.language || "en-US";
    recognizer.onresult = (event) =>
      setText(
        Array.from(event.results, (result) => result[0].transcript)
          .join(" ")
          .trim(),
      );
    recognizer.start();
    return () => recognizer.stop();
  }, [enabled, Recognizer]);

  return { text, supported };
}

/**
 * Full-attention dictation: a modal over the thread that makes clear typing is paused
 * while recording, with a large center-playhead waveform, a live transcript preview,
 * and a microphone picker. Esc cancels; Enter (or Done) inserts the text.
 */
export function DictationModal({
  source,
  onCancel,
  onDone,
}: {
  source: DictationSource;
  onCancel: () => void;
  onDone: (transcript: string) => void;
}) {
  const live = source === "microphone";
  const [deviceId, setDeviceId] = useState("default");
  const [picking, setPicking] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const startedAt = useRef(performance.now());
  const doneButton = useRef<HTMLButtonElement>(null);
  const microphone = useMicrophone(live, deviceId);
  const speech = useSpeechTranscript(live && !microphone.error);

  useEffect(() => {
    doneButton.current?.focus();
    const id = window.setInterval(
      () => setElapsed(performance.now() - startedAt.current),
      CLOCK_MS,
    );
    return () => window.clearInterval(id);
  }, []);

  const devices = live ? microphone.devices : SIMULATED_DEVICES;
  const device = devices.find((item) => item.id === deviceId) ?? {
    id: "default",
    label: "System Default",
  };
  const transcript = live ? speech.text : simulatedTranscript(elapsed);
  const read = live
    ? microphone.read
    : () => simulatedLevel(performance.now() - startedAt.current);
  const notice = microphone.error ??
    (live && !speech.supported
      ? "The waveform is live, but this browser has no speech service, so no text will appear."
      : undefined);

  // The modal handles Tab and Escape; an open microphone picker takes Escape first.
  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape" && picking) {
      event.preventDefault();
      setPicking(false);
    }
    if (event.key === "Enter" && !(event.target instanceof HTMLButtonElement)) {
      event.preventDefault();
      onDone(transcript);
    }
  }

  return (
    <Modal className="dictation" labelledBy="dictation-title" onClose={onCancel} onKeyDown={onKeyDown}>
        <header className="dictation-header">
          <p id="dictation-title">
            <span className="rec-dot" aria-hidden="true" />
            Listening
            <span className="dictation-time">{formatElapsed(elapsed)}</span>
          </p>
          <div className="device-picker">
            <button
              aria-haspopup="listbox"
              aria-expanded={picking}
              onClick={() => setPicking(!picking)}
            >
              {device.label} <span aria-hidden="true">▾</span>
            </button>
            {picking && (
              <ul role="listbox" aria-label="Choose microphone">
                {devices.map((item) => (
                  <li key={item.id}>
                    <button
                      role="option"
                      aria-selected={item.id === deviceId}
                      onClick={() => {
                        setDeviceId(item.id);
                        setPicking(false);
                      }}
                    >
                      <span className="radio" aria-hidden="true" />
                      {item.label}
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </header>

        <Waveform read={read} />

        <p className={transcript ? "dictation-text" : "dictation-text muted"} aria-live="polite">
          {transcript || "Start speaking…"}
        </p>
        {notice && <p className="dictation-notice">{notice}</p>}

        <footer className="dictation-footer">
          <span className="muted">Typing is paused while recording</span>
          <div>
            <button className="btn btn-sm" onClick={onCancel}>
              Cancel
            </button>
            <button
              ref={doneButton}
              className="dictation-done"
              onClick={() => onDone(transcript)}
            >
              <span className="stop-square" aria-hidden="true" /> Done
            </button>
          </div>
        </footer>
    </Modal>
  );
}
