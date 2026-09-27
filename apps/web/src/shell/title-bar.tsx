import { SidebarTrigger } from "@yaklabs/ui/components/sidebar";
import { useRuntimeState } from "../runtime";
import type { ChromeChoice } from "../chrome";
import type { ThemeChoice } from "../theme";
import { Account } from "./account";
import { Bell } from "./bell";
import { DataMarker } from "./data-marker";
import { LayoutSwitch } from "./layout-switch";
import { useShell } from "./model";
import { TabStrip } from "./tab-strip";

// Decorative, as a desktop window's: they do nothing, and a screen reader never meets them. On
// the green bar they need no ring to stand out.
const LIGHTS = ["close", "minimise", "zoom"] as const;

function TrafficLights() {
  return (
    <div data-slot="traffic-lights" aria-hidden="true" className="flex shrink-0 gap-2 pr-2 pl-4">
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

/**
 * The window's one title bar, across its whole width: decorative traffic lights, the sidebar
 * toggle and the open threads at the left; at the right where the data lives, the layout, the
 * bell, and the account in the corner (ADR-094). It is green chrome, flat or painted (ADR-105,
 * ADR-110).
 */
export function TitleBar({ theme, chrome }: { theme: ThemeChoice; chrome: ChromeChoice }) {
  const shell = useShell();
  const starting = useRuntimeState().kind === "starting";
  return (
    <header
      data-slot="title-bar"
      data-chrome={chrome.style}
      className="chrome-surface flex h-11 shrink-0 items-center gap-2 pr-3 select-none"
    >
      <TrafficLights />
      <SidebarTrigger
        aria-label="Toggle sidebar"
        className="shrink-0 rounded-[var(--radius)] text-soft-ink hover:text-ink"
      />
      <TabStrip shell={shell} starting={starting} />
      <div className="flex shrink-0 items-center gap-2">
        <DataMarker />
        <LayoutSwitch shell={shell} />
        <Bell shell={shell} />
        <Account theme={theme} chrome={chrome} />
      </div>
    </header>
  );
}
