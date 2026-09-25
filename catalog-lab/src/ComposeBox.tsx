import { useRef, type FormEvent } from "react";

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
      <rect x="9" y="3" width="6" height="11" rx="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
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
      <path d="M2 14h12M4 12V8M8 12V4M12 12V6" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

/** Context that will ride along with the next message, shown as a removable chip. */
export type ComposeAttachment = { id: string; label: string };

/**
 * The one compose field every chat surface uses (ADR-026): attach on the far left,
 * dictate then send on the right, and a fixed height so typing never moves it (ADR-003).
 * Attachment upload is not wired in the lab; the paperclip opens the file picker only.
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
}: {
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onDictate?: () => void;
  disabled?: boolean;
  placeholder?: string;
  attachments?: ComposeAttachment[];
  onRemoveAttachment?: (id: string) => void;
}) {
  const files = useRef<HTMLInputElement>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (draft.trim()) onSend();
  }

  return (
    <form className="compose-box" onSubmit={submit}>
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
        <button
          type="button"
          className="compose-icon"
          aria-label="Attach files"
          title="Attach files"
          disabled={disabled}
          onClick={() => files.current?.click()}
        >
          <PaperclipIcon />
        </button>
        <input ref={files} type="file" multiple hidden tabIndex={-1} />
        {attachments.length > 0 ? (
          <div className="compose-context" aria-label="Sent with your next message">
            {attachments.map((item) => (
              <span key={item.id} className="context-chip">
                <ChartGlyph />
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
        <button type="submit" className="compose-send" disabled={disabled || !draft.trim()} aria-label="Send">
          ↑
        </button>
      </div>
    </form>
  );
}
