import { SidebarInset, SidebarProvider } from "@yaklabs/ui/components/sidebar";
import { cssVars } from "@yaklabs/ui/lib/utils";
import { useState, type ReactNode } from "react";
import type { ThemeChoice } from "../theme";
import { AppSidebar } from "./sidebar";
import { TitleBar } from "./title-bar";

// The visitor's own choice of an open or a collapsed sidebar, kept like the theme.
const SIDEBAR_KEY = "kay.sidebar";
// A window this wide opens with the sidebar open, until the visitor chooses.
const WIDE_PX = 1280;

// Read before the first paint, so the sidebar never jumps; a browser that refuses storage
// decides by the window's width.
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

/**
 * The app drawn as a desktop window (ADR-094): a rounded frame on the page's own ground with a
 * margin around it, full-bleed on a narrow screen. The title bar runs its whole width; below it
 * the sidebar (shadcn's sidebar-16 pattern) and, inset like Kay's content pane, the workspace.
 */
export function Window({ theme, children }: { theme: ThemeChoice; children: ReactNode }) {
  const [open, setOpen] = useState(readSidebarOpen);
  return (
    <div
      data-slot="window"
      className="fixed inset-0 flex flex-col overflow-hidden bg-paper md:inset-2 md:rounded-[12px] md:border md:border-hairline md:shadow-[0_8px_32px_var(--shadow)]"
    >
      <SidebarProvider
        open={open}
        onOpenChange={(next) => {
          setOpen(next);
          rememberSidebar(next);
        }}
        className="min-h-0 flex-1 flex-col"
        style={cssVars({ "--sidebar-width": "16rem", "--sidebar-width-icon": "3.5rem" })}
      >
        <TitleBar theme={theme} />
        <div className="relative flex min-h-0 flex-1">
          <AppSidebar />
          <SidebarInset className="m-0 grid min-h-0 max-w-none min-w-0 overflow-hidden bg-background p-0 *:[grid-area:1/1] md:rounded-tl-[10px] md:border-t md:border-l md:border-hairline">
            {children}
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
