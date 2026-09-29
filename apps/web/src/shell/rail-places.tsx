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
} from "lucide-react";
import { useId, type ComponentType, type ReactElement, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { usePaths } from "../runtime";

// The mark as meetkay.ai declares it (ADR-095): one polygon, drawn in the text colour.
const KAY_MARK_POINTS =
  "52.4 39.26 78.59 78.54 26.16 78.54 52.34 39.32 26.25 39.26 .03 78.45 0 .02 26.19 .02 26.25 39.08 52.39 0 78.55 .06 52.4 39.26";

// Kay's documentation, a Kay plugin's natural home (ADR-078).
const DOCS_URL = "https://docs.meetkay.ai";

// A place's two looks, its glyph soft in both until the pointer is on it or its place is open:
// a 40px square in the desktop's rail, 10px of padding centring the 20px glyph, that names its
// place in a pill; and a labelled row in the phone's drawer, the glyph the same 10px in.
const LOOKS = {
  square: "size-10 p-2.5 text-soft-ink hover:text-ink data-active:text-ink [&_svg]:size-5",
  row: "h-10 gap-3 px-2.5 text-sm text-soft-ink hover:text-ink data-active:text-ink [&_svg]:size-5",
} as const;
type Look = keyof typeof LOOKS;

// What a place not built yet says, as the splash switch's Bonsai does; the drawer's row has
// room for the short form only, as a 208px sidebar beside "Automations" had.
const SOON = "Coming soon";
const SOON_SHORT = "Soon";

// A place not built yet (design pillars, rule 27): faint ink, the dimmest text the sidebar
// allows (an archived row's, 5.17:1 on paper, 5.46:1 dark), in place of shadcn's half opacity,
// which would take the glyph to 2.2:1. No hover fill and no step to ink, since there is nothing
// to press. The pointer still lands on it (shadcn turns that off for aria-disabled), so resting
// on it shows its pill and, as on a link, does not slide the panel out.
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

// A place's glyph: a lucide icon, or Kay's own mark.
type Glyph = ComponentType<{ className?: string }>;

// One place in the rail, by what pressing it does: Kay's link home, drawn in the brand's mark
// and serif; a route of the app, marked while it is open; a site elsewhere, in a new tab; or a
// place the web build does not have yet, which opens nothing.
type RailPlace =
  | { kind: "home"; label: string; Glyph: Glyph; to: "/" }
  | { kind: "route"; label: string; Glyph: Glyph; to: "/lab" }
  | { kind: "external"; label: string; Glyph: Glyph; href: string }
  | { kind: "soon"; label: string; Glyph: Glyph };

// A place that opens something.
type LivePlace = Exclude<RailPlace, { kind: "soon" }>;

/** Kay's mark, one polygon in the text colour; decorative, so its host carries the name. */
export function KayMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 78.59 78.54" aria-hidden="true" focusable="false" className={className}>
      <polygon fill="currentColor" points={KAY_MARK_POINTS} />
    </svg>
  );
}

// The rail's places top to bottom (ADR-094, amended): Kay, then the places Kay's desktop app
// has and the web build does not yet, each keeping its name and glyph (Ethan, after Kay's own
// rail), then the documentation link, and the Lab last.
const PLACES = [
  { kind: "home", label: "Kay", Glyph: KayMark, to: "/" },
  { kind: "soon", label: "Memory", Glyph: Brain },
  { kind: "soon", label: "Skills", Glyph: Unplug },
  { kind: "soon", label: "App store", Glyph: Store },
  { kind: "soon", label: "Analytics", Glyph: ChartColumnIncreasing },
  { kind: "soon", label: "Automations", Glyph: Clock },
  { kind: "external", label: "Documentation", Glyph: BookOpen, href: DOCS_URL },
  { kind: "route", label: "Lab", Glyph: FlaskConical, to: "/lab" },
] as const satisfies readonly RailPlace[];

// The pill a square names its place in, whatever the panel beside the rail is doing. It says
// shown, since the menu button hides a pill unless the sidebar is collapsed, and the rail is
// not the sidebar.
const pillOf = (children: ReactNode) =>
  ({ children, variant: "pill", sideOffset: PILL_OFFSET_PX, hidden: false }) as const;

// What a live place opens: a route of the app, or a site of its own in a new tab.
function linkOf(place: LivePlace, hrefTo: (path: "/" | "/lab") => string) {
  if (place.kind === "external") {
    return <a href={place.href} target="_blank" rel="noreferrer" aria-label={place.label} />;
  }
  return <Link to={hrefTo(place.to)} aria-label={place.label} />;
}

// How each kind of live place draws its glyph and name: Kay's mark and serif name in ink, the
// rest in the row's own ink.
const FACES = {
  home: { glyph: "text-ink", name: "font-serif text-lg text-ink" },
  route: { glyph: undefined, name: "text-ink" },
  external: { glyph: undefined, name: "text-ink" },
} as const satisfies Record<LivePlace["kind"], { glyph: string | undefined; name: string }>;

// A live place's glyph, and in a row its name after it, with an arrow after a site elsewhere.
function Face({ place, look }: { place: LivePlace; look: Look }) {
  const { Glyph, label, kind } = place;
  const face = FACES[kind]; // → the glyph's and the name's classes
  const glyph = <Glyph className={face.glyph} />;
  if (look === "square") return glyph;
  return (
    <>
      {glyph}
      <span className={face.name}>{label}</span>
      {kind === "external" && (
        <ArrowUpRight aria-hidden="true" className="ml-auto size-3.5! text-soft-ink" />
      )}
    </>
  );
}

// What a live place's pill says: its name, and after a site elsewhere the row's arrow, a step
// softer, so the pill says it opens a new tab as the row does. The gap is the one shadcn's
// tooltip keeps between its words and a key (tooltip.tsx).
function PillWords({ place }: { place: LivePlace }) {
  if (place.kind !== "external") return place.label;
  return (
    <span className="inline-flex items-center gap-1.5">
      {place.label}
      <ArrowUpRight aria-hidden="true" className={`size-3.5 ${PILL_HINT}`} />
    </span>
  );
}

// A place that opens something: a square that names it in a pill, or a row that shows its name.
function Place({
  place,
  look,
  link,
  active,
}: {
  place: LivePlace;
  look: Look;
  link: ReactElement;
  active: boolean;
}) {
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        render={link}
        isActive={active}
        tooltip={look === "square" ? pillOf(<PillWords place={place} />) : undefined}
        className={LOOKS[look]}
      >
        <Face place={place} look={look} />
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

// A place the web build does not have yet: a button that is there to be found, by pointer,
// keyboard and screen reader ("Memory, dimmed, button, Coming soon"), and opens nothing. It
// keeps its look's size and padding, so its glyph sits where a live place's would.
function SoonPlace({ label, Glyph, look }: { label: string; Glyph: Glyph; look: Look }) {
  const hint = useId(); // → string, unique per drawing
  const pill = (
    <>
      {label}
      <span className={PILL_HINT}> · {SOON}</span>
    </>
  );
  return (
    <SidebarMenuItem>
      <SidebarMenuButton
        type="button"
        aria-label={label}
        aria-disabled="true"
        aria-describedby={hint}
        tooltip={look === "square" ? pillOf(pill) : undefined}
        className={`${LOOKS[look]} ${SOON_BUTTON}`}
      >
        <Glyph />
        {look === "row" && <span>{label}</span>}
        <span id={hint} className="sr-only">
          {SOON}
        </span>
        {look === "row" && (
          <span aria-hidden="true" className="ml-auto shrink-0 text-xs">
            {SOON_SHORT}
          </span>
        )}
      </SidebarMenuButton>
    </SidebarMenuItem>
  );
}

/**
 * The app's fixed places: Kay, the places not built yet, the documentation link, and the Lab
 * last (ADR-094, amended). A route's place is marked while it is open.
 * @param look Squares that name their places in pills, for the desktop's rail (ADR-139); or
 *   labelled rows, for the phone's drawer (ADR-121).
 */
export function RailPlaces({ look }: { look: Look }) {
  const { hrefTo } = usePaths();
  const at = useLocation().pathname; // → the open route, such as "/lab"
  return (
    <SidebarHeader className="gap-0.5 px-2 pt-2">
      <TooltipProvider delay={PILL_DELAY_MS} closeDelay={0}>
        <SidebarMenu className="gap-0.5">
          {PLACES.map((place) =>
            place.kind === "soon" ? (
              <SoonPlace key={place.label} label={place.label} Glyph={place.Glyph} look={look} />
            ) : (
              <Place
                key={place.label}
                place={place}
                look={look}
                link={linkOf(place, hrefTo)}
                active={place.kind === "route" && at === place.to}
              />
            ),
          )}
        </SidebarMenu>
      </TooltipProvider>
    </SidebarHeader>
  );
}
