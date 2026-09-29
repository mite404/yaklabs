import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@yaklabs/ui/components/sidebar";
import { TooltipProvider } from "@yaklabs/ui/components/tooltip";
import { ArrowUpRight, BookOpen, FlaskConical } from "lucide-react";
import type { ReactElement, ReactNode } from "react";
import { Link } from "react-router";

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

/**
 * The rail's fixed places: Kay, the documentation link, and the Lab, above the projects.
 * @param pills Whether their names show in pills: the collapsed rail, not while it peeks.
 * @param echo Draws them for the rail's echo beneath the sidebar.
 */
export function RailPlaces({
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
