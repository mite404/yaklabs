import { SidebarTrigger, useSidebar } from "@yaklabs/ui/components/sidebar";
import { useRuntimeState } from "../runtime";
import type { ThemeChoice } from "../theme";
import { Account } from "./account";
import { Bell } from "./bell";
import { DataMarker } from "./data-marker";
import { LayoutSwitch } from "./layout-switch";
import { useShell } from "./model";
import { SIDEBAR_ID } from "./sidebar";
import { TabStrip } from "./tab-strip";

// Decorative, as a desktop window's: they do nothing, and a screen reader never meets them. On
// a phone the window is full-bleed, not a window, so they go.
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
          className="size-3 rounded-full border border-hairline"
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
 * bell, and the account in the corner (ADR-094). On a phone the tabs take a row of their own
 * below, so neither they nor the controls are squeezed off the screen.
 */
export function TitleBar({ theme }: { theme: ThemeChoice }) {
  const shell = useShell();
  const starting = useRuntimeState().kind === "starting";
  return (
    <header
      data-slot="title-bar"
      className="grid shrink-0 grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-1 bg-paper px-3 py-[5px] select-none md:flex md:h-11 md:py-0 md:pl-0"
    >
      <TrafficLights />
      <SidebarToggle />
      <TabStrip shell={shell} starting={starting} />
      <div className="flex shrink-0 items-center gap-2 max-md:col-start-2 max-md:row-start-1 max-md:min-w-0 max-md:justify-end">
        <DataMarker />
        <LayoutSwitch shell={shell} />
        <Bell shell={shell} />
        <Account theme={theme} />
      </div>
    </header>
  );
}
