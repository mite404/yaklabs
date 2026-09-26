// Inline icons keep the lab dependency-free; strokes follow currentColor.
const STROKE = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
} as const;

/** A chevron pointing right; rotates to point down when `open`. */
export function ChevronIcon({ open = false }: { open?: boolean }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width="14"
      height="14"
      aria-hidden="true"
      style={{ transform: open ? "rotate(90deg)" : undefined }}
    >
      <path d="M6 3.5 10.5 8 6 12.5" {...STROKE} />
    </svg>
  );
}

/** Share: an arrow leaving a box. */
export function ShareIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path d="M8 2.5v7M5 5l3-3 3 3M3.5 8.5v4a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-4" {...STROKE} />
    </svg>
  );
}

/** A chain link, for copying a link. */
export function LinkIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        d="M6.8 9.2a2.6 2.6 0 0 0 3.7 0l2-2a2.6 2.6 0 0 0-3.7-3.7l-.6.6M9.2 6.8a2.6 2.6 0 0 0-3.7 0l-2 2a2.6 2.6 0 0 0 3.7 3.7l.6-.6"
        {...STROKE}
      />
    </svg>
  );
}

/** A window with an arrow: opens in a new tab. */
export function ExternalIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        d="M9.5 2.5h4v4M13.5 2.5 8 8M12 9.5v3a1 1 0 0 1-1 1H3.5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1h3"
        {...STROKE}
      />
    </svg>
  );
}

/** A stack of files, for attaching images and files. */
export function FilesIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <path
        d="M11.5 6.3 7.1 10.7a1.9 1.9 0 0 1-2.7-2.7l4.6-4.6a3.1 3.1 0 0 1 4.4 4.4L8.8 12.4a4.3 4.3 0 0 1-6.1-6.1L6.8 2.2"
        {...STROKE}
      />
    </svg>
  );
}

/** A monitor, for taking a screenshot. */
export function ScreenIcon() {
  return (
    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true">
      <rect x="2" y="3" width="12" height="8" rx="1" {...STROKE} />
      <path d="M6 13.5h4M8 11v2.5" {...STROKE} />
    </svg>
  );
}
