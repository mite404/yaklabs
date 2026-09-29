import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@yaklabs/ui/components/sidebar";
import { TooltipProvider } from "@yaklabs/ui/components/tooltip";
import { ArrowUpRight, BookOpen, FlaskConical } from "lucide-react";
import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { usePaths } from "../runtime";
import { Account, type Looks } from "./account";
import { ProjectTree } from "./project-tree";
import { PeekHotZone, peekProps, useSidebarPeek, type SidebarPeek } from "./sidebar-peek";
import { SidebarResizeHandle } from "./sidebar-resize";

// The mark as meetkay.ai declares it (ADR-095): one polygon, drawn in the text colour.
const KAY_MARK_POINTS =
  "52.4 39.26 78.59 78.54 26.16 78.54 52.34 39.32 26.25 39.26 .03 78.45 0 .02 26.19 .02 26.25 39.08 52.39 0 78.55 .06 52.4 39.26";

// Kay's documentation, a Kay plugin's natural home (ADR-078).
const DOCS_URL = "https://docs.meetkay.ai";

// A rail button as today's rail drew them: 40px in the collapsed rail, the label beside it
// open, the glyph soft until the pointer is on it or its place is open. 10px of padding puts
// the 20px glyph in the same spot open and collapsed (centred in the collapsed square), so the
// peek's glyphs land exactly on the rail's.
const RAIL_BUTTON =
  "h-10 gap-3 px-2.5 text-sm text-soft-ink hover:text-ink data-active:text-ink group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-2.5! [&_svg]:size-5";

// A rail place's name shows in a pill after the pointer rests on it 350ms; moving on to the
// next place while one shows opens the next at once (Base UI's delay group).
const PILL_DELAY_MS = 350;
// The pill sits 8px off the place's square.
const PILL_OFFSET_PX = 8;

// The rail's echo keeps its own slot, so a check that reads the sidebar's header finds one.
const ECHO_HEADER = { "data-slot": "rail-echo-header" };

/** Kay's mark, one polygon in the text colour; decorative, so its host carries the name. */
export function KayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 78.59 78.54" aria-hidden="true" focusable="false" className={className}>
      <polygon fill="currentColor" points={KAY_MARK_POINTS} />
    </svg>
  );
}

// One place in the rail's header, whose name shows in a pill while the rail is collapsed.
function Place({
  label,
  link,
  active = false,
  pill,
  children,
}: {
  label: string;
  link: ReactElement;
  active?: boolean;
  pill: boolean;
  children: ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={link}
        isActive={active}
        tooltip={{ children: label, variant: "pill", sideOffset: PILL_OFFSET_PX, hidden: !pill }}
        className={RAIL_BUTTON}
      >
        {children}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

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

// The rail's fixed places: Kay, the documentation link, and the Lab, above the projects. `pills`
// says whether their names show in pills (the collapsed rail, not while it peeks); `echo`
// draws them for the rail's echo.
function RailPlaces({
  hrefTo,
  onLab,
  pills,
  echo = false,
}: {
  hrefTo: (path: "/" | "/lab") => string;
  onLab: boolean;
  pills: boolean;
  echo?: boolean;
}) {
  return (
    <SidebarHeader className="gap-0.5 px-2 pt-2" {...(echo ? ECHO_HEADER : {})}>
      <TooltipProvider delay={PILL_DELAY_MS} closeDelay={0}>
        <SidebarMenu className="gap-0.5">
          <Place label="Kay" link={<Link to={hrefTo("/")} aria-label="Kay" />} pill={pills}>
            <KayMark className="text-ink" />
            <span className="font-serif text-lg text-ink">Kay</span>
          </Place>
          <Place
            label="Documentation"
            link={<a href={DOCS_URL} target="_blank" rel="noreferrer" aria-label="Documentation" />}
            pill={pills}
          >
            <BookOpen />
            <span className="text-ink">Documentation</span>
            <ArrowUpRight aria-hidden="true" className="ml-auto size-3.5! text-soft-ink" />
          </Place>
          <Place label="Lab" link={<Link to={hrefTo("/lab")} />} active={onLab} pill={pills}>
            <FlaskConical />
            <span className="text-ink">Lab</span>
          </Place>
        </SidebarMenu>
      </TooltipProvider>
    </SidebarHeader>
  );
}

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
