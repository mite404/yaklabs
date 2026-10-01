import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import {
  SIMULATED_DEVICES,
  formatElapsed,
  liveNotice,
  simulatedLevel,
  simulatedTranscript,
  type AudioDevice,
} from "./dictation";
import { DevicePicker } from "./DevicePicker";
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

// Live transcription through the browser's speech service, where one exists, and what to tell
// the user when it fails, since the waveform keeps moving either way.
function useSpeechTranscript(enabled: boolean) {
  const [text, setText] = useState("");
  const [failure, setFailure] = useState<string>();
  const [silent, setSilent] = useState(false);
  const Recognizer = speechRecognizer();
  const supported = Recognizer !== undefined;

  useEffect(() => {
    const sink = {
      onText: setText,
      onFailure: setFailure,
      onSilence: () => {
        setSilent(true);
      },
    };
    const stop = enabled && Recognizer ? transcribe(Recognizer, sink) : undefined;
    return () => {
      stop?.();
    };
  }, [enabled, Recognizer]);

  return { text, supported, failure, silent };
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

function viewFor(
  live: boolean,
  microphone: Microphone,
  speech: Speech,
  elapsed: number,
  startedAt: number,
  deviceId: string,
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
    notice: liveNotice({
      microphoneError: microphone.error,
      supported: speech.supported,
      failure: speech.failure,
      silent: speech.silent,
      heard: speech.text !== "",
      deviceId,
    }),
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
    deviceId,
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
          live={live}
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
