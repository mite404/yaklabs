import type { ThreadId, ThreadSummary } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import { Skeleton } from "@yaklabs/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@yaklabs/ui/components/tabs";
import { Plus, X } from "lucide-react";
import { useEffect, useState } from "react";
import { panelId } from "./deck";
import { LAYOUTS } from "./layouts";
import type { Shell } from "./model";
import { viewOf } from "./state";

// A tab's box. A tablist may own only tabs, so each close button sits in a layer over the
// tablist, in a slot with this same box in the same row: it lines up with its tab unmeasured.
const TAB_BOX = "w-[220px] min-w-28 shrink data-active:min-w-40";

// Marks a tab hovered while the pointer is on it or on its close button. The two sit in
// different layers, so neither :hover nor a Tailwind group can pair them.
type Hover = {
  hovered: ThreadId | null;
  handlers: (id: ThreadId) => { onPointerEnter: () => void; onPointerLeave: () => void };
};

function tabId(main: ThreadId): string {
  return `tab-${main}`;
}

function useHover(): Hover {
  const [hovered, setHovered] = useState<ThreadId | null>(null);
  return {
    hovered,
    handlers: (id) => ({
      onPointerEnter: () => {
        setHovered(id);
      },
      onPointerLeave: () => {
        setHovered((current) => (current === id ? null : current));
      },
    }),
  };
}

// Scrolls the active tab into view whenever it changes.
function useInView(active: ThreadId | null): void {
  useEffect(() => {
    if (active !== null)
      document
        .querySelector(`#${CSS.escape(tabId(active))}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
}

// One open thread: its layout's glyph and title (APG: Delete closes a focused tab, and a
// middle click closes any).
function Tab({ thread, shell, hover }: { thread: ThreadSummary; shell: Shell; hover: Hover }) {
  const { Icon } = LAYOUTS[viewOf(shell.doc, thread.id).pane];
  const close = () => {
    shell.close(thread.id);
  };
  return (
    <div
      role="presentation"
      data-active={shell.active?.main === thread.id || undefined}
      className={`flex ${TAB_BOX}`}
    >
      <TabsTrigger
        value={thread.id}
        id={tabId(thread.id)}
        aria-controls={panelId(thread.id)}
        data-hovered={hover.hovered === thread.id || undefined}
        className="tab h-[30px] w-full min-w-0 flex-none justify-start gap-2 rounded-[var(--radius)] border-hairline/0 bg-paper-deep px-2.5 text-xs font-normal data-hovered:pr-7 data-active:pr-7 text-soft-ink hover:text-ink data-active:border-hairline data-active:bg-[var(--control-bg)] data-active:text-ink dark:text-soft-ink dark:data-active:border-hairline dark:data-active:bg-[var(--control-bg)]"
        {...hover.handlers(thread.id)}
        onAuxClick={(event) => {
          if (event.button === 1) close();
        }}
        onKeyDown={(event) => {
          if (event.key === "Delete" || event.key === "Backspace") close();
        }}
      >
        <Icon className="size-3.5 shrink-0" aria-hidden="true" />
        <span className="truncate">{thread.title}</span>
      </TabsTrigger>
    </div>
  );
}

// A tab's close button, in its slot over the tab's right end: shown on the active tab and while
// the pointer is on the tab. It is for the pointer; the keyboard closes a tab with Delete.
function CloseSlot({
  thread,
  shell,
  hover,
}: {
  thread: ThreadSummary;
  shell: Shell;
  hover: Hover;
}) {
  const active = shell.active?.main === thread.id;
  return (
    <div data-active={active || undefined} className={`relative ${TAB_BOX}`}>
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Close ${thread.title}`}
        data-shown={active || hover.hovered === thread.id || undefined}
        className="pointer-events-auto absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] border-0 bg-transparent p-0 text-soft-ink opacity-0 data-shown:opacity-100 hover:bg-paper-deep hover:text-ink"
        {...hover.handlers(thread.id)}
        onClick={() => {
          shell.close(thread.id);
        }}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The open threads as shadcn Tabs: choosing one goes to its address, which is what makes it
 * active. Tabs narrow as more open; past their floor the strip scrolls, fading at an edge with
 * tabs beyond it, and keeps the active one in view. While the runtime starts, one skeleton tab
 * holds the place; a failed start leaves the strip empty.
 */
export function TabStrip({ shell, starting }: { shell: Shell | null; starting: boolean }) {
  const active = shell?.active?.main ?? null;
  const hover = useHover();
  useInView(active);
  return (
    <div className="flex min-w-0 flex-1 items-center gap-1">
      <Tabs
        value={active}
        onValueChange={(value) => {
          const tab = shell?.tabs.find((each) => each.id === value);
          if (tab) shell?.open(tab.id);
        }}
        className="min-w-0 flex-row"
      >
        <div className="tab-scroller no-scrollbar grid min-w-0 overflow-x-auto">
          <TabsList
            aria-label="Open threads"
            className="h-auto w-auto min-w-0 justify-start gap-1 bg-transparent p-0 [grid-area:1/1]"
          >
            {starting && <Skeleton className="h-[30px] w-40 rounded-[var(--radius)]" />}
            {shell?.tabs.map((thread) => (
              <Tab key={thread.id} thread={thread} shell={shell} hover={hover} />
            ))}
          </TabsList>
          <div className="pointer-events-none flex min-w-0 gap-1 [grid-area:1/1]">
            {shell?.tabs.map((thread) => (
              <CloseSlot key={thread.id} thread={thread} shell={shell} hover={hover} />
            ))}
          </div>
        </div>
      </Tabs>
      <Button
        variant="ghost"
        size="icon-sm"
        className="rounded-[var(--radius)] text-soft-ink"
        aria-label="New thread"
        disabled={shell === null}
        onClick={() => {
          shell?.newThread();
        }}
      >
        <Plus />
      </Button>
    </div>
  );
}
