import {
  useCallback,
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

// Whether an event happened inside `container`. A window-level event, such as a resize, has no
// node to be inside of, so it never did.
function isInside(container: Node | null, target: EventTarget | null): boolean {
  return container !== null && target instanceof Node && container.contains(target);
}

// The items the arrow keys move between, in order.
function enabledItems(list: HTMLElement): HTMLButtonElement[] {
  return Array.from(list.querySelectorAll<HTMLButtonElement>("button:not(:disabled)"));
}

/** What a menu hands its trigger: spread these props onto the button that opens it. */
export type TriggerProps = {
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

  const close = (refocus = true) => {
    setOpen(false);
    if (refocus) button.current?.focus();
  };

  // The list exists only while the menu is open. Mounted, it focuses its first available item
  // and closes the menu on a click outside it, or on any scroll or resize; unmounted, it stops.
  const whileOpen = useCallback((list: HTMLUListElement) => {
    enabledItems(list)[0]?.focus();
    const outside = (event: PointerEvent) => {
      if (!isInside(root.current, event.target)) setOpen(false);
    };
    const away = (event: Event) => {
      if (!isInside(list, event.target)) setOpen(false);
    };
    document.addEventListener("pointerdown", outside);
    window.addEventListener("scroll", away, true);
    window.addEventListener("resize", away);
    return () => {
      document.removeEventListener("pointerdown", outside);
      window.removeEventListener("scroll", away, true);
      window.removeEventListener("resize", away);
    };
  }, []);

  function keys(event: KeyboardEvent<HTMLUListElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "ArrowDown" && event.key !== "ArrowUp") return;
    event.preventDefault();
    const enabled = enabledItems(event.currentTarget); // → HTMLButtonElement[]
    const at = enabled.findIndex((item) => item === document.activeElement); // → -1 when none
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
          ref={whileOpen}
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
