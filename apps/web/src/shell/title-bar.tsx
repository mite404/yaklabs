import { SidebarTrigger, useSidebar } from "@yaklabs/ui/components/sidebar";
import { useRuntimeState } from "../runtime";
import { Account, type Looks } from "./account";
import { Bell } from "./bell";
import { DataMarker } from "./data-marker";
import { LayoutSwitch } from "./layout-switch";
import { useShell } from "./model";
import { SIDEBAR_ID } from "./sidebar";
import { TabStrip } from "./tab-strip";
import { threadActions } from "./state";
import { ThreadMenu } from "./thread-menu";

// Decorative, as a desktop window's: they do nothing, and a screen reader never meets them. On
// a phone the window is full-bleed, not a window, so they go; on the green bar they need no ring.
const LIGHTS = ["close", "minimise", "zoom"] as const;

function TrafficLights() {
  return (
    <div
      data-slot="traffic-lights"
      aria-hidden="true"
      className="flex shrink-0 gap-2 pr-2 pl-4 max-md:hidden"
    >
      {LIGHTS.map((light) => (
        <span
          key={light}
          className="size-3 rounded-full"
          style={{ background: `var(--traffic-${light})` }}
        />
      ))}
    </div>
  );
}

// The sidebar's toggle is a disclosure: it says whether the sidebar is open (on a phone, its
// sheet) and names the landmark it shows and hides. Open, it looks as it does closed; the ghost
// button's expanded fill is for a menu's trigger while its menu is up.
function SidebarToggle() {
  const { open, openMobile, isMobile } = useSidebar();
  return (
    <SidebarTrigger
      aria-label="Toggle sidebar"
      aria-expanded={isMobile ? openMobile : open}
      aria-controls={SIDEBAR_ID}
      className="shrink-0 rounded-[var(--radius)] text-soft-ink hover:text-ink aria-expanded:bg-transparent aria-expanded:text-soft-ink aria-expanded:hover:bg-muted aria-expanded:hover:text-ink dark:aria-expanded:hover:bg-muted/50"
    />
  );
}

/**
 * The window's one title bar, across its whole width: decorative traffic lights, the sidebar
 * toggle and the open threads at the left; at the right where the data lives, the layout, the
 * bell, and the account in the corner (ADR-094). It is green chrome, flat or painted (ADR-110,
 * ADR-115). On a phone it is two rows (ADR-116): the project's name and what never scrolls on
 * top, with a "⋯" for the thread and project; below, the views, Thread, Browser and Canvas.
 */
export function TitleBar({ theme, chrome }: Looks) {
  const shell = useShell();
  const starting = useRuntimeState().kind === "starting";
  return (
    <header
      data-slot="title-bar"
      data-chrome={chrome.style}
      className="chrome-surface flex h-11 shrink-0 items-center gap-2 pr-3 select-none max-md:grid max-md:h-auto max-md:grid-cols-[auto_minmax(0,1fr)_repeat(4,auto)] max-md:grid-rows-[44px_auto] max-md:gap-x-1 max-md:gap-y-0 max-md:px-2 max-md:pb-1.5"
    >
      <TrafficLights />
      <SidebarToggle />
      <span
        data-slot="project-name"
        className="min-w-0 truncate px-1 text-sm font-medium text-ink md:hidden"
      >
        {shell === null ? null : threadActions(shell.workspace, shell.active).name}
      </span>
      <TabStrip shell={shell} starting={starting} />
      <div className="flex shrink-0 items-center gap-2 max-md:contents">
        <DataMarker />
        <LayoutSwitch shell={shell} />
        <Bell shell={shell} />
        <Account theme={theme} chrome={chrome} />
        <ThreadMenu shell={shell} />
      </div>
    </header>
  );
}
