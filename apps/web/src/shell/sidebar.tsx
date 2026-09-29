import { Sidebar, SidebarContent, SidebarFooter, useSidebar } from "@yaklabs/ui/components/sidebar";
import { useEffect, useRef } from "react";
import { useLocation } from "react-router";
import { usePaths } from "../runtime";
import { Account, type Looks } from "./account";
import { ProjectTree } from "./project-tree";
import { RailPlaces } from "./rail-places";
import { PeekHotZone, peekProps, useSidebarPeek, type SidebarPeek } from "./sidebar-peek";
import { SidebarResizeHandle } from "./sidebar-resize";

// On a phone the sidebar is a drawer that pushes the page aside (ADR-121), so every arrival
// somewhere new (by a row, a place or a "+") closes it: what was chosen is what shows.
function useSheetClosesOnArrival(): void {
  const { key } = useLocation();
  const { setOpenMobile } = useSidebar();
  const shownAt = useRef(key);
  useEffect(() => {
    if (shownAt.current === key) return;
    shownAt.current = key;
    setOpenMobile(false);
  }, [key, setOpenMobile]);
}

/** The id of the sidebar's navigation landmark, which the title bar's toggle controls. */
export const SIDEBAR_ID = "sidebar";

// The collapsed rail drawn once more beneath the sidebar: when it peeks, the one sidebar slides
// out over the workspace from the window's edge and back, and this keeps the rail's places and
// face where they were, so the rail never blinks as the panel leaves it. At rest the rail covers
// it exactly. Decorative: hidden from assistive technology and inert.
function RailEcho({
  looks,
  hrefTo,
  onLab,
}: {
  looks: Looks;
  hrefTo: (path: "/" | "/lab") => string;
  onLab: boolean;
}) {
  return (
    <div
      aria-hidden="true"
      inert
      data-slot="rail-echo"
      data-state="collapsed"
      data-collapsible="icon"
      className="group absolute inset-y-0 left-0 flex w-(--sidebar-width-icon) flex-col bg-sidebar"
    >
      <RailPlaces hrefTo={hrefTo} onLab={onLab} pills={false} echo />
      <SidebarFooter className="mt-auto">
        <Account theme={looks.theme} chrome={looks.chrome} side="top" align="start" />
      </SidebarFooter>
    </div>
  );
}

// Whether the rail's places name themselves in pills: collapsed on a desktop, not peeking.
function usePills(peek: SidebarPeek): boolean {
  const { state, isMobile } = useSidebar();
  return state === "collapsed" && !isMobile && peek.phase === "rail";
}

// What the peek puts around the sidebar while it can peek: the rail's echo beneath it and, at
// rest, the strip past the rail's edge.
function PeekScenery({
  peek,
  looks,
  hrefTo,
  onLab,
}: {
  peek: SidebarPeek;
  looks: Looks;
  hrefTo: (path: "/" | "/lab") => string;
  onLab: boolean;
}) {
  if (!peek.enabled) return null;
  return (
    <>
      <RailEcho looks={looks} hrefTo={hrefTo} onLab={onLab} />
      {peek.phase === "rail" && <PeekHotZone />}
    </>
  );
}

/** The sidebar's width as the window keeps it, and the way to change it. */
export type SidebarWidth = { width: number; onWidth: (px: number) => void };

/**
 * The sidebar below the title bar (shadcn's sidebar-16 pattern), one navigation landmark.
 * Collapsed it is today's 56px rail of places, each naming itself in a pill; open it names them
 * and lists the projects. The account and the theme sit at its foot, outside the navigation
 * landmark, in the rail too (ADR-121). Collapsed on a desktop it peeks: the same sidebar slides
 * out over the workspace (sidebar-peek.tsx). Its right edge resizes it, pinned or peeking.
 */
export function AppSidebar({ theme, chrome, width, onWidth }: Looks & SidebarWidth) {
  const { hrefTo } = usePaths();
  const onLab = useLocation().pathname === "/lab";
  const panel = useRef<HTMLDivElement>(null);
  const peek = useSidebarPeek(panel);
  const pills = usePills(peek);
  useSheetClosesOnArrival();
  return (
    <>
      <Sidebar
        ref={panel}
        collapsible="icon"
        mobile="push"
        {...peekProps(peek)}
        className="absolute h-full border-r-0 group-data-[side=left]:border-r-0"
      >
        <div
          id={SIDEBAR_ID}
          // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the catalog's tokens.css styles every bare nav (its gap, and the colour of each span in a button), which would restyle the tree
          role="navigation"
          aria-label="Sidebar"
          className="flex min-h-0 flex-1 flex-col"
        >
          <RailPlaces hrefTo={hrefTo} onLab={onLab} pills={pills} />
          <SidebarContent>
            <ProjectTree />
          </SidebarContent>
        </div>
        <SidebarFooter>
          <Account theme={theme} chrome={chrome} side="top" align="start" />
        </SidebarFooter>
        <SidebarResizeHandle width={width} onWidth={onWidth} controls={SIDEBAR_ID} />
      </Sidebar>
      <PeekScenery peek={peek} looks={{ theme, chrome }} hrefTo={hrefTo} onLab={onLab} />
    </>
  );
}
