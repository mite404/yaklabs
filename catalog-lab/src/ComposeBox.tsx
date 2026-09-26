import { useRef, type FormEvent, type KeyboardEvent } from "react";
import { FilesIcon, ScreenIcon } from "./icons";
import { Menu } from "./Menu";
import { captureScreenshot } from "./screenshot";

// Inline icons keep the lab dependency-free; strokes follow currentColor.
function PaperclipIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <path
        d="M21 11.5 12.4 20a5.5 5.5 0 0 1-7.8-7.8l8.6-8.5a3.7 3.7 0 0 1 5.2 5.2l-8.6 8.5a1.8 1.8 0 0 1-2.6-2.6l7.9-7.8"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MicIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
      <rect
        x="9"
        y="3"
        width="6"
        height="11"
        rx="3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <path
        d="M5.5 11a6.5 6.5 0 0 0 13 0M12 17.5V21"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** A small bar-chart glyph marking card context, shared by compose and sent messages. */
export function ChartGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <path
        d="M2 14h12M4 12V8M8 12V4M12 12V6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Context that will ride along with the next message, shown as a removable chip: a card
 *  choice (ADR-030) or a file the user attached, such as a screenshot (ADR-063). */
export type ComposeAttachment = { id: string; label: string; kind?: "card" | "file" };

// Whether this browser can capture a screen, window or tab.
function canCaptureScreen(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getDisplayMedia);
}

// A small picture glyph for file chips, matching the chart glyph's weight.
function FileGlyph() {
  return (
    <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
      <rect
        x="2"
        y="3"
        width="12"
        height="10"
        rx="1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path
        d="m4.5 11 3-3 2 2 1.5-1.5 1.5 1.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/**
 * The one compose field every chat surface uses (ADR-026): attach on the far left,
 * dictate then send on the right, and a fixed height so typing never moves it (ADR-003).
 * The paperclip opens a menu (ADR-063): add images and files (⌘U), or take a screenshot,
 * the shortest path from "look at this" to the agent seeing it.
 * @param onAttachFiles Receives picked files and screenshots; the host shows them as chips.
 * @param onDictate Opens dictation; the host shows the dictation modal (ADR-028).
 * @param disabled Pauses typing, e.g. while dictation is recording.
 * @param attachments Card choices that will be sent with the next message (ADR-030); they
 * take the hint's place in the bar, so the box never changes height (ADR-003).
 */
export function ComposeBox({
  draft,
  onDraftChange,
  onSend,
  onDictate,
  disabled = false,
  placeholder = "What would you like to do?",
  attachments = [],
  onRemoveAttachment,
  onAttachFiles,
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onDictate?: () => void;
  disabled?: boolean;
  placeholder?: string;
  attachments?: ComposeAttachment[];
  onRemoveAttachment?: (id: string) => void;
  onAttachFiles?: (files: File[]) => void;
}) {
  const files = useRef<HTMLInputElement>(null);

  async function screenshot() {
    const file = await captureScreenshot();
    if (file) onAttachFiles?.([file]);
  }

  // ⌘U (Ctrl+U elsewhere) adds files, as the menu's shortcut hint says.
  function shortcut(event: KeyboardEvent) {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "u") {
      event.preventDefault();
      files.current?.click();
    }
  }

  // A message can be just an attachment: a screenshot often says enough on its own.
  const canSend = draft.trim() !== "" || attachments.length > 0;

  function submit(event: FormEvent) {
    event.preventDefault();
    if (canSend) onSend();
  }

  return (
    <form className="compose-box" onSubmit={submit} onKeyDown={shortcut}>
      <textarea
        aria-label="Message"
        placeholder={disabled ? "Recording…" : placeholder}
        disabled={disabled}
        value={draft}
        onChange={(event) => onDraftChange(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) submit(event);
        }}
      />
      <div className="compose-bar">
        <Menu
          label="Attach"
          placement="above-start"
          items={[
            {
              label: "Add images & files",
              icon: <FilesIcon />,
              shortcut: "⌘U",
              onSelect: () => files.current?.click(),
            },
            {
              label: "Take screenshot",
              icon: <ScreenIcon />,
              disabled: !canCaptureScreen(),
              hint: canCaptureScreen() ? undefined : "This browser cannot capture the screen",
              onSelect: () => void screenshot(),
            },
          ]}
          renderTrigger={(props) => (
            <button
              {...props}
              type="button"
              className="compose-icon"
              aria-label="Attach"
              title="Attach"
              disabled={disabled}
            >
              <PaperclipIcon />
            </button>
          )}
        />
        <input
          ref={files}
          type="file"
          multiple
          hidden
          tabIndex={-1}
          onChange={(event) => {
            const picked = Array.from(event.target.files ?? []);
            if (picked.length) onAttachFiles?.(picked);
            event.target.value = "";
          }}
        />
        {attachments.length > 0 ? (
          <div className="compose-context" aria-label="Sent with your next message">
            {attachments.map((item) => (
              <span key={item.id} className="context-chip">
                {item.kind === "file" ? <FileGlyph /> : <ChartGlyph />}
                {item.label}
                <button
                  type="button"
                  aria-label={`Don't send ${item.label}`}
                  onClick={() => onRemoveAttachment?.(item.id)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        ) : (
          <span className="compose-hint muted">Enter to send · Shift+Enter for a new line</span>
        )}
        <button
          type="button"
          className="compose-icon"
          aria-label="Dictate"
          title="Dictate"
          disabled={disabled}
          onClick={onDictate}
        >
          <MicIcon />
        </button>
        <button
          type="submit"
          className="compose-send"
          disabled={disabled || !canSend}
          aria-label="Send"
        >
          ↑
        </button>
      </div>
    </form>
  );
}
