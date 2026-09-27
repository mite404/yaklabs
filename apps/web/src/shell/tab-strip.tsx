import type { ThreadId, ThreadSummary } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import { Skeleton } from "@yaklabs/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@yaklabs/ui/components/tabs";
import { Plus, X } from "lucide-react";
import { useEffect } from "react";
import { panelId } from "./deck";
import { LAYOUTS } from "./layouts";
import type { Shell } from "./model";
import { viewOf } from "./state";

function tabId(main: ThreadId): string {
  return `tab-${main}`;
}

// One open thread: its layout's glyph and title, and a close beside it (APG: Delete closes a
// focused tab, and a middle click closes any).
function Tab({ thread, shell }: { thread: ThreadSummary; shell: Shell }) {
  const { Icon } = LAYOUTS[viewOf(shell.doc, thread.id).pane];
  const close = () => {
    shell.close(thread.id);
  };
  return (
    <div role="presentation" className="group/tab relative flex shrink-0">
      <TabsTrigger
        value={thread.id}
        id={tabId(thread.id)}
        aria-controls={panelId(thread.id)}
        className="tab h-[30px] w-[220px] min-w-28 flex-none shrink justify-start gap-2 rounded-[var(--radius)] border-hairline/0 bg-paper-deep px-2.5 pr-7 text-xs font-normal text-soft-ink hover:text-ink data-active:border-hairline data-active:bg-[var(--control-bg)] data-active:text-ink dark:text-soft-ink dark:data-active:border-hairline dark:data-active:bg-[var(--control-bg)]"
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
      <button
        type="button"
        tabIndex={-1}
        aria-label={`Close ${thread.title}`}
        className="absolute top-1/2 right-1.5 flex size-5 -translate-y-1/2 items-center justify-center rounded-[var(--radius)] border-0 bg-transparent p-0 text-soft-ink opacity-0 group-hover/tab:opacity-100 group-has-data-active/tab:opacity-100 hover:bg-paper-deep hover:text-ink"
        onClick={close}
      >
        <X className="size-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

/**
 * The open threads as shadcn Tabs: choosing one goes to its address, which is what makes it
 * active. The strip scrolls once tabs reach their floor, keeping the active one in view. While
 * the runtime starts, one skeleton tab holds the place; a failed start leaves the strip empty.
 */
export function TabStrip({ shell, starting }: { shell: Shell | null; starting: boolean }) {
  const active = shell?.active?.main ?? null;
  useEffect(() => {
    if (active !== null)
      document
        .querySelector(`#${CSS.escape(tabId(active))}`)
        ?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [active]);
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
        <TabsList
          aria-label="Open threads"
          className="no-scrollbar h-auto w-auto min-w-0 justify-start gap-1 overflow-x-auto bg-transparent p-0"
        >
          {starting && <Skeleton className="h-[30px] w-40 rounded-[var(--radius)]" />}
          {shell?.tabs.map((thread) => (
            <Tab key={thread.id} thread={thread} shell={shell} />
          ))}
        </TabsList>
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
