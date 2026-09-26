import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

// Keeps Tab inside the dialog, so focus cannot wander to what the modal pauses.
function trapTab(event: KeyboardEvent<HTMLElement>) {
  const focusable = Array.from(
    event.currentTarget.querySelectorAll<HTMLElement>(
      "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex='0']",
    ),
  ); // → HTMLElement[]
  const first = focusable.at(0);
  const last = focusable.at(-1);
  if (!first || !last) return;
  if (event.shiftKey && document.activeElement === first) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * A modal dialog over its container (ADR-062): a scrim that pauses what is behind it, a
 * focus trap, Escape to close, and focus returned to where it was when the modal closes.
 * It covers its nearest positioned ancestor, so a modal opened in the thread covers only
 * the thread, not the whole app.
 * @param labelledBy The id of the element that names the dialog.
 * @param onClose Called on Escape; the caller decides what closing means.
 * @param onKeyDown Extra keys for the dialog's own content (runs before Escape handling).
 */
export function Modal({
  labelledBy,
  onClose,
  onKeyDown,
  className,
  children,
}: {
  labelledBy: string;
  onClose: () => void;
  onKeyDown?: (event: KeyboardEvent<HTMLElement>) => void;
  className?: string;
  children: ReactNode;
}) {
  const opener = useRef<Element | null>(null);

  // Remember what had focus, and give it back when the modal closes.
  useEffect(() => {
    opener.current = document.activeElement;
    return () => {
      if (opener.current instanceof HTMLElement) opener.current.focus();
    };
  }, []);

  function keys(event: KeyboardEvent<HTMLElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented) return;
    if (event.key === "Tab") trapTab(event);
    if (event.key === "Escape") {
      event.preventDefault();
      onClose();
    }
  }

  // A <dialog> shown in place with `open`, not in the top layer with showModal(), which would
  // cover the whole page; aria-modal still tells assistive technology the rest is paused.
  return (
    <div className="modal-backdrop">
      <dialog
        open
        className={className ? `modal ${className}` : "modal"}
        aria-modal="true"
        aria-labelledby={labelledBy}
        onKeyDown={keys}
      >
        {children}
      </dialog>
    </div>
  );
}
