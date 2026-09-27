import {
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@yaklabs/ui/components/sidebar";
import { ArrowUpRight, BookOpen, FlaskConical } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { usePaths } from "../runtime";
import { ProjectTree } from "./project-tree";

// The mark as meetkay.ai declares it (ADR-095): one polygon, drawn in the text colour.
const KAY_MARK_POINTS =
  "52.4 39.26 78.59 78.54 26.16 78.54 52.34 39.32 26.25 39.26 .03 78.45 0 .02 26.19 .02 26.25 39.08 52.39 0 78.55 .06 52.4 39.26";

// Kay's documentation, a Kay plugin's natural home (ADR-078).
const DOCS_URL = "https://docs.meetkay.ai";

// A rail button as today's rail drew them: 40px in the collapsed rail, the label beside it open.
const RAIL_BUTTON = "h-10 gap-3 px-3 text-sm group-data-[collapsible=icon]:size-10! [&_svg]:size-5";

/** Kay's mark, one polygon in the text colour; decorative, since its link carries the name. */
export function KayMark({ className }: { className?: string }) {
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

/**
 * The sidebar below the title bar (shadcn's sidebar-16 pattern). Collapsed it is today's 56px
 * rail of places; open it names them and lists the projects. The account and the theme live in
 * the title bar, so the rail keeps only places.
 */
export function AppSidebar() {
  const { hrefTo } = usePaths();
  const { pathname } = useLocation();
  return (
    <Sidebar
      collapsible="icon"
      className="absolute h-full border-r-0 group-data-[side=left]:border-r-0"
    >
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
            <span>Documentation</span>
            <ArrowUpRight aria-hidden="true" className="ml-auto size-3.5! text-soft-ink" />
          </Place>
          <Place label="Lab" link={<Link to={hrefTo("/lab")} />} active={pathname === "/lab"}>
            <FlaskConical />
            <span>Lab</span>
          </Place>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <ProjectTree />
      </SidebarContent>
    </Sidebar>
  );
}
