import { levelFromSamples, type AudioDevice } from "./dictation";

// The live dictation source: the user's microphone, measured frame by frame, and the browser's
// speech service. Each starter begins listening at once and returns the function that stops it.

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
type SpeechRecognizerClass = new () => SpeechRecognizer;
type SpeechWindow = Window & {
  SpeechRecognition?: SpeechRecognizerClass;
  webkitSpeechRecognition?: SpeechRecognizerClass;
};

// Where a live microphone reports to while it listens.
type MicrophoneSink = {
  onLevel: (level: number) => void;
  onDevices: (devices: AudioDevice[]) => void;
  onError: (message: string) => void;
};

// What the user reads when the microphone cannot open, by the reason the browser gives.
function microphoneError(reason: unknown): string {
  return reason instanceof DOMException && reason.name === "NotAllowedError"
    ? "Microphone access was blocked. Allow it in your browser settings to dictate."
    : "No microphone could be opened.";
}

// The inputs to pick from, named for the picker; unnamed ones are numbered.
function audioInputs(all: MediaDeviceInfo[]): AudioDevice[] {
  return all
    .filter((device) => device.kind === "audioinput")
    .map((device, index) => ({
      id: device.deviceId,
      label:
        device.deviceId === "default"
          ? "System Default"
          : device.label || `Microphone ${index + 1}`,
    }));
}

/** The browser's speech recognizer, prefixed or not, or undefined where there is none. */
export function speechRecognizer(): SpeechRecognizerClass | undefined {
  const speechWindow: SpeechWindow = window;
  return speechWindow.SpeechRecognition ?? speechWindow.webkitSpeechRecognition;
}

/**
 * Opens a microphone, reports its level every animation frame, then lists the inputs to pick
 * from. Failures, including a refused permission, go to `sink.onError`, never to the caller.
 * @returns The stop: it closes the stream, even one granted after stopping was asked for.
 */
export function listenToMicrophone(deviceId: string, sink: MicrophoneSink): () => void {
  let stopped = false;
  let frame = 0;
  let stream: MediaStream | undefined;
  let context: AudioContext | undefined;

  async function listen() {
    try {
      const audio = deviceId === "default" ? true : { deviceId: { exact: deviceId } };
      const granted = await navigator.mediaDevices.getUserMedia({ audio }); // → MediaStream
      if (stopped) {
        granted.getTracks().forEach((track) => {
          track.stop();
        });
        return;
      }
      stream = granted;
      context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 1024;
      context.createMediaStreamSource(granted).connect(analyser);
      const samples = new Float32Array(analyser.fftSize);
      const measure = () => {
        analyser.getFloatTimeDomainData(samples);
        sink.onLevel(levelFromSamples(samples));
        frame = requestAnimationFrame(measure);
      };
      measure();
      const all = await navigator.mediaDevices.enumerateDevices(); // → MediaDeviceInfo[]
      sink.onDevices(audioInputs(all)); // → AudioDevice[]
    } catch (reason: unknown) {
      sink.onError(microphoneError(reason));
    }
  }

  void listen();
  return () => {
    stopped = true;
    cancelAnimationFrame(frame);
    stream?.getTracks().forEach((track) => {
      track.stop();
    });
    void context?.close();
  };
}

/**
 * Runs the browser's speech service continuously, reporting the whole transcript so far each
 * time it changes.
 * @returns The stop.
 */
export function transcribe(
  Recognizer: SpeechRecognizerClass,
  onText: (text: string) => void,
): () => void {
  const recognizer = new Recognizer();
  recognizer.continuous = true;
  recognizer.interimResults = true;
  recognizer.lang = navigator.language || "en-US";
  recognizer.onresult = (event) => {
    onText(
      Array.from(event.results, (result) => result[0].transcript)
        .join(" ")
        .trim(),
    );
  };
  recognizer.start();
  return () => {
    recognizer.stop();
  };
}
