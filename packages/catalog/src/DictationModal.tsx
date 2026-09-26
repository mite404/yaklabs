import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  SIMULATED_DEVICES,
  formatElapsed,
  simulatedLevel,
  simulatedTranscript,
  type AudioDevice,
} from "./dictation";
import { listenToMicrophone, speechRecognizer, transcribe } from "./liveDictation";
import { Modal } from "./Modal";
import { Waveform } from "./Waveform";
import "./dictation.css";

/** Where audio comes from: a deterministic simulation, or the user's real microphone. */
export type DictationSource = "simulated" | "microphone";

// How often the visible timer and simulated transcript refresh.
const CLOCK_MS = 250;

// Live input: a real microphone stream measured by an AnalyserNode.
function useMicrophone(enabled: boolean, deviceId: string) {
  const level = useRef(0);
  const [devices, setDevices] = useState<AudioDevice[]>([]);
  const [error, setError] = useState<string>();

  useEffect(() => {
    const stop = enabled
      ? listenToMicrophone(deviceId, {
          onLevel: (value) => {
            level.current = value;
          },
          onDevices: setDevices,
          onError: setError,
        })
      : undefined;
    return () => {
      stop?.();
    };
  }, [enabled, deviceId]);

  return { read: () => level.current, devices, error };
}

// Live transcription through the browser's speech service, where one exists.
function useSpeechTranscript(enabled: boolean) {
  const [text, setText] = useState("");
  const Recognizer = speechRecognizer();
  const supported = Recognizer !== undefined;

  useEffect(() => {
    const stop = enabled && Recognizer ? transcribe(Recognizer, setText) : undefined;
    return () => {
      stop?.();
    };
  }, [enabled, Recognizer]);

  return { text, supported };
}

type Microphone = ReturnType<typeof useMicrophone>;
type Speech = ReturnType<typeof useSpeechTranscript>;

// What the modal shows for its source: the devices, the transcript so far, the level to draw,
// and a notice when the browser cannot deliver part of it.
type DictationView = {
  devices: AudioDevice[];
  transcript: string;
  read: () => number;
  notice: string | undefined;
};

const NO_SPEECH_NOTICE =
  "The waveform is live, but this browser has no speech service, so no text will appear.";

function viewFor(
  live: boolean,
  microphone: Microphone,
  speech: Speech,
  elapsed: number,
  startedAt: number,
): DictationView {
  if (!live) {
    return {
      devices: SIMULATED_DEVICES,
      transcript: simulatedTranscript(elapsed),
      read: () => simulatedLevel(performance.now() - startedAt),
      notice: undefined,
    };
  }
  return {
    devices: microphone.devices,
    transcript: speech.text,
    read: microphone.read,
    notice: microphone.error ?? (speech.supported ? undefined : NO_SPEECH_NOTICE),
  };
}

// The modal handles Tab and Escape; an open microphone picker takes Escape first, and Enter
// anywhere but on a button finishes the recording.
function keyAction(
  key: string,
  picking: boolean,
  onButton: boolean,
): "close-picker" | "done" | undefined {
  if (key === "Escape" && picking) return "close-picker";
  if (key === "Enter" && !onButton) return "done";
  return undefined;
}

// The microphone list: a button naming the current device, and a listbox while it is open.
function DevicePicker({
  devices,
  deviceId,
  open,
  onToggle,
  onPick,
}: {
  devices: AudioDevice[];
  deviceId: string;
  open: boolean;
  onToggle: () => void;
  onPick: (id: string) => void;
}) {
  const device = devices.find((item) => item.id === deviceId) ?? {
    id: "default",
    label: "System Default",
  };
  return (
    <div className="device-picker">
      <button aria-haspopup="listbox" aria-expanded={open} onClick={onToggle}>
        {device.label} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        // Options sit directly in the listbox: an <li> there fails axe's listitem rule.
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a <select> cannot draw these radio-dot rows; this is the ARIA listbox pattern
        <div className="device-list" role="listbox" aria-label="Choose microphone">
          {devices.map((item) => (
            <button
              key={item.id}
              className="device-option"
              // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- <option> is valid only inside a <select>, which this list cannot be
              role="option"
              aria-selected={item.id === deviceId}
              onClick={() => {
                onPick(item.id);
              }}
            >
              <span className="radio" aria-hidden="true" />
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
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
  // Read once, on the first render: the recording's start never moves.
  const [startedAt] = useState(() => performance.now());
  const doneButton = useRef<HTMLButtonElement>(null);
  const microphone = useMicrophone(live, deviceId);
  const speech = useSpeechTranscript(live && !microphone.error);

  useEffect(() => {
    doneButton.current?.focus();
    const id = window.setInterval(() => {
      setElapsed(performance.now() - startedAt);
    }, CLOCK_MS);
    return () => {
      window.clearInterval(id);
    };
  }, [startedAt]);

  const { devices, transcript, read, notice } = viewFor(
    live,
    microphone,
    speech,
    elapsed,
    startedAt,
  ); // → DictationView

  function onKeyDown(event: KeyboardEvent<HTMLElement>) {
    const action = keyAction(event.key, picking, event.target instanceof HTMLButtonElement);
    if (action === undefined) return;
    event.preventDefault();
    if (action === "close-picker") setPicking(false);
    else onDone(transcript);
  }

  return (
    <Modal
      className="dictation"
      labelledBy="dictation-title"
      onClose={onCancel}
      onKeyDown={onKeyDown}
    >
      <header className="dictation-header">
        <p id="dictation-title">
          <span className="rec-dot" aria-hidden="true" />
          Listening
          <span className="dictation-time">{formatElapsed(elapsed)}</span>
        </p>
        <DevicePicker
          devices={devices}
          deviceId={deviceId}
          open={picking}
          onToggle={() => {
            setPicking(!picking);
          }}
          onPick={(id) => {
            setDeviceId(id);
            setPicking(false);
          }}
        />
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
            onClick={() => {
              onDone(transcript);
            }}
          >
            <span className="stop-square" aria-hidden="true" /> Done
          </button>
        </div>
      </footer>
    </Modal>
  );
}
