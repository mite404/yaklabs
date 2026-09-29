// The visitor's choices for the sidebar, kept like the theme: open or collapsed, and the width
// its edge was dragged to. Both are read before the first paint, so the sidebar and the tabs
// never jump, and both reach the page as the CSS the sidebar and the title bar read.
import { cssVars } from "@yaklabs/ui/lib/utils";
import { useState, type CSSProperties } from "react";
import type { SidebarWidth } from "./sidebar";
import { parseStoredWidth, SIDEBAR_DEFAULT_PX, widthValue } from "./sidebar-width";

// The visitor's own choice of an open or a collapsed sidebar.
const SIDEBAR_KEY = "kay.sidebar";
// The width the visitor dragged the sidebar to, in CSS px.
const WIDTH_KEY = "kay.sidebar-width";
// A window this wide opens with the sidebar open, until the visitor chooses.
const WIDE_PX = 1280;

// A browser that refuses storage decides by the window's width.
function readSidebarOpen(): boolean {
  try {
    const stored = localStorage.getItem(SIDEBAR_KEY); // → "open" | "closed" | null
    if (stored === "open" || stored === "closed") return stored === "open";
  } catch {
    // Private windows may refuse storage.
  }
  return window.innerWidth >= WIDE_PX;
}

function rememberSidebar(open: boolean): void {
  try {
    localStorage.setItem(SIDEBAR_KEY, open ? "open" : "closed");
  } catch {
    // The choice holds for this visit.
  }
}

function readSidebarWidth(): number {
  try {
    const kept = parseStoredWidth(localStorage.getItem(WIDTH_KEY)); // → px | null
    if (kept !== null) return kept;
  } catch {
    // Private windows may refuse storage.
  }
  return SIDEBAR_DEFAULT_PX;
}

/** Whether the sidebar is open, as the visitor last chose, and the way to choose again. */
export function useSidebarOpen(): { open: boolean; onOpenChange: (open: boolean) => void } {
  const [open, setOpen] = useState(readSidebarOpen);
  return {
    open,
    onOpenChange: (next) => {
      setOpen(next);
      rememberSidebar(next);
    },
  };
}

/** The sidebar's width as the visitor last dragged it, and the way to keep a new one. */
export function useSidebarWidth(): SidebarWidth {
  const [width, setWidth] = useState(readSidebarWidth);
  return {
    width,
    onWidth: (px) => {
      setWidth(px);
      try {
        localStorage.setItem(WIDTH_KEY, String(px));
      } catch {
        // The width holds for this visit.
      }
    },
  };
}

/**
 * The sidebar's sizes as the CSS its wrapper carries, read by the sidebar and by the title bar,
 * whose tabs start at the sidebar's edge.
 * @param width The kept width, in CSS px.
 */
export function sidebarVars(width: number): CSSProperties {
  return cssVars({
    "--sidebar-width": widthValue(width),
    "--sidebar-width-icon": "3.5rem",
    // On a phone the drawer takes most of the width and leaves the page's edge in view.
    "--sidebar-width-mobile": "min(85vw, 20rem)",
  });
}
