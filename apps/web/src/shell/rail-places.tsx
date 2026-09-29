import {
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@yaklabs/ui/components/sidebar";
import { TooltipProvider } from "@yaklabs/ui/components/tooltip";
import {
  ArrowUpRight,
  BookOpen,
  Brain,
  ChartColumnIncreasing,
  Clock,
  FlaskConical,
  Store,
  Unplug,
  type LucideIcon,
} from "lucide-react";
import { useId, type ReactElement, type ReactNode } from "react";
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

// The places Kay's desktop app has and the web build does not yet, in the rail's order under
// Kay (ADR-094, amended: Ethan, after Kay's own rail). Each keeps its name and glyph, says it
// is coming, and opens nothing: there is no route behind any of them.
const SOON_PLACES = [
  { label: "Memory", Icon: Brain },
  { label: "Skills", Icon: Unplug },
  { label: "App store", Icon: Store },
  { label: "Analytics", Icon: ChartColumnIncreasing },
  { label: "Automations", Icon: Clock },
] as const satisfies readonly { label: string; Icon: LucideIcon }[];

// What a place not built yet says, as the splash switch's Bonsai does; the open sidebar's row
// has room for the short form only (a 208px sidebar beside "Automations").
const SOON = "Coming soon";
const SOON_SHORT = "Soon";

// A place not built yet (design pillars, rule 27): faint ink, the dimmest text the sidebar
// allows (an archived row's, 5.17:1 on paper, 5.46:1 dark), in place of shadcn's half opacity,
// which would take the glyph to 2.2:1. No hover fill and no step to ink, since there is nothing
// to press. The pointer still lands on it (shadcn turns that off for aria-disabled), so resting
// on it shows its pill and, as on a link, does not slide the sidebar out.
const SOON_BUTTON =
  "cursor-default text-faint-ink hover:bg-transparent hover:text-faint-ink active:bg-transparent active:text-faint-ink aria-disabled:pointer-events-auto aria-disabled:opacity-100";

// The pill's "Coming soon", a step softer than the name: the pill's text at 72% over its ink,
// rule 4's step for secondary text (7.6:1 light, 6.9:1 dark).
const PILL_HINT = "text-[color-mix(in_srgb,var(--on-ink)_72%,var(--ink))]";

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

// The pill a place names itself in, shown only while the rail is collapsed and at rest.
const pillOf = (children: ReactNode, shown: boolean) =>
  ({ children, variant: "pill", sideOffset: PILL_OFFSET_PX, hidden: !shown }) as const;

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
        tooltip={pillOf(label, pill)}
        className={RAIL_BUTTON}
      >
        {children}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// A place the web build does not have yet: a button that is there to be found, by pointer,
// keyboard and screen reader ("Memory, dimmed, button, Coming soon"), and opens nothing. It
// keeps the rail's square and padding, so its glyph sits where a live place's would.
function SoonPlace({ label, Icon, pill }: { label: string; Icon: LucideIcon; pill: boolean }) {
  const hint = useId(); // → string, unique per drawing, so the rail's echo never repeats it
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        aria-label={label}
        aria-disabled="true"
        aria-describedby={hint}
        tooltip={pillOf(
          <>
            {label}
            <span className={PILL_HINT}> · {SOON}</span>
          </>,
          pill,
        )}
        className={`${RAIL_BUTTON} ${SOON_BUTTON}`}
      >
        <Icon />
        <span>{label}</span>
        <span id={hint} className="sr-only">
          {SOON}
        </span>
        <span aria-hidden="true" className="ml-auto shrink-0 text-xs">
          {SOON_SHORT}
        </span>
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * The rail's fixed places, above the projects: Kay, the places not built yet, the documentation
 * link, and the Lab last (ADR-094, amended).
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
          {SOON_PLACES.map(({ label, Icon }) => (
            <SoonPlace key={label} label={label} Icon={Icon} pill={pills} />
          ))}
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
