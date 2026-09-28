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
import { ArrowUpRight, BookOpen, FlaskConical } from "lucide-react";
import { useEffect, useRef, type ReactElement, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { usePaths } from "../runtime";
import { Account, type Looks } from "./account";
import { ProjectTree } from "./project-tree";

// The mark as meetkay.ai declares it (ADR-095): one polygon, drawn in the text colour.
const KAY_MARK_POINTS =
  "52.4 39.26 78.59 78.54 26.16 78.54 52.34 39.32 26.25 39.26 .03 78.45 0 .02 26.19 .02 26.25 39.08 52.39 0 78.55 .06 52.4 39.26";

// Kay's documentation, a Kay plugin's natural home (ADR-078).
const DOCS_URL = "https://docs.meetkay.ai";

// A rail button as today's rail drew them: 40px in the collapsed rail, the label beside it
// open, the glyph soft until the pointer is on it or its place is open. Collapsed, 10px of
// padding centres the 20px glyph in its square, where shadcn's 8px suits a 16px one.
const RAIL_BUTTON =
  "h-10 gap-3 px-3 text-sm text-soft-ink hover:text-ink data-active:text-ink group-data-[collapsible=icon]:size-10! group-data-[collapsible=icon]:p-2.5! [&_svg]:size-5";

// Kay's mark, one polygon in the text colour; decorative, since its link carries the name.
function KayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 78.59 78.54" aria-hidden="true" focusable="false" className={className}>
      <polygon fill="currentColor" points={KAY_MARK_POINTS} />
    </svg>
  );
}

// One place in the rail's header.
function Place({
  label,
  link,
  active = false,
  children,
}: {
  label: string;
  link: ReactElement;
  active?: boolean;
  children: ReactNode;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton render={link} isActive={active} tooltip={label} className={RAIL_BUTTON}>
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

// The rail's fixed places: Kay, the documentation link, and the Lab, above the projects.
function RailPlaces({ hrefTo, onLab }: { hrefTo: (path: "/" | "/lab") => string; onLab: boolean }) {
  return (
    <SidebarHeader className="gap-0.5 px-2 pt-2">
      <SidebarMenu className="gap-0.5">
        <Place label="Kay" link={<Link to={hrefTo("/")} aria-label="Kay" />}>
          <KayMark className="text-ink" />
          <span className="font-serif text-lg text-ink">Kay</span>
        </Place>
        <Place
          label="Documentation"
          link={<a href={DOCS_URL} target="_blank" rel="noreferrer" aria-label="Documentation" />}
        >
          <BookOpen />
          <span className="text-ink">Documentation</span>
          <ArrowUpRight aria-hidden="true" className="ml-auto size-3.5! text-soft-ink" />
        </Place>
        <Place label="Lab" link={<Link to={hrefTo("/lab")} />} active={onLab}>
          <FlaskConical />
          <span className="text-ink">Lab</span>
        </Place>
      </SidebarMenu>
    </SidebarHeader>
  );
}

/**
 * The sidebar below the title bar (shadcn's sidebar-16 pattern), one navigation landmark.
 * Collapsed it is today's 56px rail of places; open it names them and lists the projects. The
 * account and the theme live in the title bar; on a phone, where the bar has no room for the
 * account, it sits at the sidebar's foot instead, outside the navigation landmark (ADR-121).
 */
export function AppSidebar({ theme, chrome }: Looks) {
  const { hrefTo } = usePaths();
  const { pathname } = useLocation();
  const { isMobile } = useSidebar();
  useSheetClosesOnArrival();
  return (
    <Sidebar
      collapsible="icon"
      mobile="push"
      className="absolute h-full border-r-0 group-data-[side=left]:border-r-0"
    >
      <div
        id={SIDEBAR_ID}
        // oxlint-disable-next-line jsx-a11y/prefer-tag-over-role -- the catalog's tokens.css styles every bare nav (its gap, and the colour of each span in a button), which would restyle the tree
        role="navigation"
        aria-label="Sidebar"
        className="flex min-h-0 flex-1 flex-col"
      >
        <RailPlaces hrefTo={hrefTo} onLab={pathname === "/lab"} />
        <SidebarContent>
          <ProjectTree />
        </SidebarContent>
      </div>
      {isMobile && (
        <SidebarFooter>
          <Account theme={theme} chrome={chrome} side="top" align="start" />
        </SidebarFooter>
      )}
    </Sidebar>
  );
}
