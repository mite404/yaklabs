import {
  useEffect,
  useId,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  type Ref,
} from "react";

/** One choice in a menu. */
export type MenuItem = {
  label: string;
  icon?: ReactNode;
  /** A keyboard shortcut shown on the right, e.g. "⌘U". Display only. */
  shortcut?: string;
  disabled?: boolean;
  /** Why the item is unavailable, shown on hover. */
  hint?: string;
  onSelect: () => void;
};

/** Where the menu opens relative to its trigger. */
export type MenuPlacement = "above-start" | "below-end";

// The gap between the trigger and the menu.
const OFFSET_PX = 6;

// Fixed to the viewport beside its trigger, so no clipping container (the compose row, a
// card) can cut the menu off.
function positionFor(trigger: HTMLElement, placement: MenuPlacement): CSSProperties {
  const rect = trigger.getBoundingClientRect();
  return placement === "above-start"
    ? { position: "fixed", left: rect.left, bottom: window.innerHeight - rect.top + OFFSET_PX }
    : { position: "fixed", right: window.innerWidth - rect.right, top: rect.bottom + OFFSET_PX };
}

type TriggerProps = {
  ref: Ref<HTMLButtonElement>;
  "aria-haspopup": "menu";
  "aria-expanded": boolean;
  "aria-controls": string;
  onClick: () => void;
};

/**
 * A popup menu anchored to its trigger (ADR-062): a short list of actions, like the
 * compose box's attach menu or a card's share menu. It opens on click, moves with the
 * arrow keys, runs an item on Enter or click, and closes on Escape, a click outside, a
 * choice, or a scroll or resize (so it never drifts from its trigger), handing focus back.
 * It is positioned against the viewport, so clipping containers cannot cut it off.
 * @param trigger Renders the button that opens the menu; spread the props onto it.
 */
export function Menu({
  items,
  trigger,
  placement = "below-end",
  label,
}: {
  items: MenuItem[];
  trigger: (props: TriggerProps) => ReactNode;
  placement?: MenuPlacement;
  label: string;
}) {
  const [open, setOpen] = useState(false);
  const [style, setStyle] = useState<CSSProperties>();
  const id = useId();
  const root = useRef<HTMLSpanElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLUListElement>(null);

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  // Focus the first available item on open; close on any click outside.
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLButtonElement>("button:not(:disabled)")?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) close(false);
    };
    const away = (event: Event) => {
      if (!list.current?.contains(event.target as Node)) close(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, [open]);

  function keys(event: KeyboardEvent) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const enabled = Array.from(
      list.current?.querySelectorAll<HTMLButtonElement>("button:not(:disabled)") ?? [],
    );
    const at = enabled.indexOf(document.activeElement as HTMLButtonElement);
    const step = event.key === "ArrowDown" ? 1 : -1;
    enabled[(at + step + enabled.length) % enabled.length]?.focus();
  }

  return (
    <span className="menu-anchor" ref={root}>
      {trigger({
        ref: button,
        "aria-haspopup": "menu",
        "aria-expanded": open,
        "aria-controls": id,
        onClick: () => {
          if (!open && button.current) setStyle(positionFor(button.current, placement));
          setOpen(!open);
        },
      })}
      {open && (
        <ul
          id={id}
          ref={list}
          className="menu"
          data-placement={placement}
          style={style}
          role="menu"
          aria-label={label}
          onKeyDown={keys}
        >
          {items.map((item) => (
            <li key={item.label} role="none">
              <button
                role="menuitem"
                disabled={item.disabled}
                title={item.hint}
                onClick={() => {
                  close();
                  item.onSelect();
                }}
              >
                {item.icon && <span className="menu-icon">{item.icon}</span>}
                <span className="menu-label">{item.label}</span>
                {item.shortcut && <kbd className="menu-shortcut">{item.shortcut}</kbd>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </span>
  );
}
