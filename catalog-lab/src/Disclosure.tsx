import { useId, type ReactNode } from "react";
import { ChevronIcon } from "./icons";

/**
 * An accordion section (ADR-062): a header button that shows or hides the body below it,
 * with a chevron that points right when folded and down when open. Open, a flush line
 * under the header marks it as the fold control; folded, there is no body to separate.
 * State lives with the caller, so the same section can start folded or open.
 * @param summary What the header shows; it stays visible when the section is folded.
 */
export function Disclosure({
  summary,
  open,
  onToggle,
  children,
}: {
  summary: ReactNode;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}) {
  const body = useId();
  return (
    <div className="disclosure" data-open={open || undefined}>
      <button className="disclosure-header" aria-expanded={open} aria-controls={body} onClick={onToggle}>
        {summary}
        <span className="disclosure-chevron">
          <ChevronIcon open={open} />
        </span>
      </button>
      {open && (
        <div id={body} className="disclosure-body">
          {children}
        </div>
      )}
    </div>
  );
}
