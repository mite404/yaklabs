import { SidebarProvider, useSidebar } from "@yaklabs/ui/components/sidebar";
import { cssVars } from "@yaklabs/ui/lib/utils";
import { useState, type ReactNode } from "react";
import { useChrome } from "../chrome";
import { useMatch } from "react-router";
import { SplashSwitch } from "../components/splash-switch";
import { useSplash } from "../splash";
import type { ThemeChoice } from "../theme";
import { SharePermissions } from "./share-permissions";
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

// The workspace beside the sidebar, inset like Kay's content pane, with the deck and the route
// in one grid cell. It is the page's main landmark, except on /lab, whose workbench brings its
// own main: two, one inside the other, leave no single main to skip to. It is a div on every
// route, since swapping the element would remount the deck and lose every open tab.
function Workspace({ children }: { children: ReactNode }) {
  const onLab = useMatch("/lab") !== null;
  const { isMobile, openMobile } = useSidebar();
  return (
    <div
      // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- a main element cannot drop its role on /lab
      role={onLab ? undefined : "main"}
      // Pushed aside by the phone's drawer, it shows at the edge but takes no focus (ADR-121).
      inert={isMobile && openMobile}
      className="relative grid min-h-0 w-full min-w-0 flex-1 overflow-hidden bg-background *:[grid-area:1/1] md:rounded-tl-[10px] md:border-t md:border-l md:border-hairline"
    >
      {children}
    </div>
  );
}

/**
 * The app drawn as a desktop window (ADR-094): a rounded frame on a desk of its own with a
 * margin around it, full-bleed on a narrow screen (ADR-111). The green title bar runs its whole
 * width (ADR-110); below it, the sidebar (shadcn's sidebar-16 pattern) and,
 * inset like Kay's content pane, the workspace.
 */
export function Window({ theme, children }: { theme: ThemeChoice; children: ReactNode }) {
  const [open, setOpen] = useState(readSidebarOpen);
  const chrome = useChrome();
  const splash = useSplash();
  return (
    <>
      <div data-slot="desk" aria-hidden="true" className="fixed inset-0 bg-[var(--desk)]" />
      <div
        data-slot="window"
        className="fixed inset-0 flex flex-col overflow-hidden bg-paper md:inset-4 md:rounded-[12px] md:border md:border-hairline md:shadow-[0_8px_32px_var(--shadow)]"
      >
        <SidebarProvider
          open={open}
          onOpenChange={(next) => {
            setOpen(next);
            rememberSidebar(next);
          }}
          className="min-h-0 flex-1 flex-col transition-transform duration-300 ease-out motion-reduce:transition-none max-md:data-mobile-open:translate-x-(--sidebar-width-mobile)"
          style={cssVars({
            "--sidebar-width": "16rem",
            "--sidebar-width-icon": "3.5rem",
            // On a phone the drawer takes most of the width and leaves the page's edge in view.
            "--sidebar-width-mobile": "min(85vw, 20rem)",
          })}
        >
          <TitleBar theme={theme} chrome={chrome} />
          <div data-slot="window-body" className="relative flex min-h-0 flex-1">
            <AppSidebar theme={theme} chrome={chrome} />
            <Workspace>{children}</Workspace>
          </div>
        </SidebarProvider>
      </div>
      <SharePermissions />
      <SplashSwitch splash={splash} />
    </>
  );
}
