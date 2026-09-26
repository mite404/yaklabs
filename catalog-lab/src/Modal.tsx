import { useEffect, useRef, type KeyboardEvent, type ReactNode } from "react";

// What Tab can reach inside the dialog.
const FOCUSABLE =
  "button:not([disabled]), input:not([disabled]), textarea:not([disabled]), [tabindex='0']";

// Keeps Tab inside the dialog, so focus cannot wander to what the modal pauses. Focus on the
// dialog itself (on open with nothing to focus, or after a click on its text) counts as the
// start, so Shift+Tab from there wraps to the end.
function trapTab(event: KeyboardEvent<HTMLElement>) {
  const focusable = event.currentTarget.querySelectorAll<HTMLElement>(FOCUSABLE);
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (!first || !last) return;
  const atStart =
    document.activeElement === first || document.activeElement === event.currentTarget;
  if (event.shiftKey && atStart) {
    event.preventDefault();
    last.focus();
  } else if (!event.shiftKey && document.activeElement === last) {
    event.preventDefault();
    first.focus();
  }
}

/**
 * A modal dialog over its container (ADR-062): a scrim that pauses what is behind it, focus
 * moved in on open (to the first control, or the dialog itself), a focus trap, Escape to
 * close, and focus returned to where it was when the modal closes.
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
  const dialog = useRef<HTMLElement>(null);
  const opener = useRef<Element | null>(null);

  // Remember what had focus and take it, so Escape and Tab work at once; give it back on close.
  useEffect(() => {
    opener.current = document.activeElement;
    const box = dialog.current;
    if (box) (box.querySelector<HTMLElement>(FOCUSABLE) ?? box).focus();
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

  return (
    <div className="modal-backdrop">
      <section
        ref={dialog}
        className={className ? `modal ${className}` : "modal"}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        onKeyDown={keys}
      >
        {children}
      </section>
    </div>
  );
}
