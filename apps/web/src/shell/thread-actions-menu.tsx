import type { ThreadSummary } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuTrigger,
} from "@yaklabs/ui/components/dropdown-menu";
import { useSidebar } from "@yaklabs/ui/components/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import {
  AlarmClock,
  Archive,
  ArchiveRestore,
  Ellipsis,
  Link,
  Pin,
  PinOff,
  Trash2,
} from "lucide-react";
import type { ComponentProps } from "react";
import { useShell, type Shell } from "./model";
import { wakeText } from "./snooze";

/** The label every "⋯" for a thread carries, in its title bar or the phone's (ADR-124). */
export const THREAD_ACTIONS = "Thread actions";

// What each item acts on: the shell's verbs and the thread.
type ItemProps = { shell: Shell; thread: ThreadSummary };

// Pin names what it would do now: Pin thread, or Unpin thread (ADR-125).
function PinItem({ shell, thread }: ItemProps) {
  const pinned = thread.pinnedAt !== null;
  return (
    <DropdownMenuItem
      onClick={() => {
        shell.pin(thread.id, !pinned);
      }}
    >
      {pinned ? <PinOff aria-hidden="true" /> : <Pin aria-hidden="true" />}
      {pinned ? "Unpin thread" : "Pin thread"}
    </DropdownMenuItem>
  );
}

// Snooze opens the card; a snoozed thread's item says when it wakes (ADR-126).
function SnoozeItem({ shell, thread, before }: ItemProps & { before?: () => void }) {
  return (
    <DropdownMenuItem
      onClick={() => {
        before?.();
        shell.askSnooze(thread.id);
      }}
    >
      <AlarmClock aria-hidden="true" />
      Snooze
      {thread.snoozedUntil !== null && (
        <DropdownMenuShortcut>
          {wakeText(new Date(thread.snoozedUntil), "menu")}
        </DropdownMenuShortcut>
      )}
    </DropdownMenuItem>
  );
}

// Archive names what it would do now: Archive, or Unarchive (ADR-127).
function ArchiveItem({ shell, thread }: ItemProps) {
  const archived = thread.archivedAt !== null;
  return (
    <DropdownMenuItem
      onClick={() => {
        shell.archive(thread.id, !archived);
      }}
    >
      {archived ? <ArchiveRestore aria-hidden="true" /> : <Archive aria-hidden="true" />}
      {archived ? "Unarchive" : "Archive"}
    </DropdownMenuItem>
  );
}

/**
 * The thread menu's items (ADR-124), in Ethan's order: Copy thread URL, Share thread, Pin,
 * Snooze, Archive, then Delete apart. Pin and Archive name what they would do now. Delete keeps
 * ink for its words, which the red does not clear on a dark menu (ADR-065); its icon is red.
 * @param beforeSnooze Runs before the snooze card opens, to bring the thread into view.
 */
export function ThreadActionsContent({
  shell,
  thread,
  beforeSnooze,
  ...props
}: ItemProps & { beforeSnooze?: () => void } & ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent align="end" className="w-56" {...props}>
      <DropdownMenuGroup>
        <DropdownMenuItem
          onClick={() => {
            shell.copyUrl(thread.id);
          }}
        >
          <Link aria-hidden="true" />
          Copy thread URL
        </DropdownMenuItem>
        <PinItem shell={shell} thread={thread} />
        <SnoozeItem shell={shell} thread={thread} before={beforeSnooze} />
        <ArchiveItem shell={shell} thread={thread} />
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => {
          shell.remove(thread.id);
        }}
      >
        <Trash2 aria-hidden="true" className="text-destructive" />
        Delete
      </DropdownMenuItem>
    </DropdownMenuContent>
  );
}

// The "⋯" in a thread's own title bar, on a desktop.
function ThreadMenuButton({ shell, thread }: { shell: Shell; thread: ThreadSummary }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={THREAD_ACTIONS}
            className="rounded-[var(--radius)] text-soft-ink hover:text-ink"
          />
        }
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenuTrigger>
      <ThreadActionsContent shell={shell} thread={thread} />
    </DropdownMenu>
  );
}

// The pin in a pinned thread's title bar (ADR-125); pressing it unpins.
function PinnedMark({ shell, thread }: { shell: Shell; thread: ThreadSummary }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Unpin thread"
            data-pinned=""
            className="rounded-[var(--radius)] text-ink"
            onClick={() => {
              shell.pin(thread.id, false);
            }}
          />
        }
      >
        <Pin aria-hidden="true" className="fill-current" />
      </TooltipTrigger>
      <TooltipContent>Pinned to the top of its list. Click to unpin.</TooltipContent>
    </Tooltip>
  );
}

/**
 * What a thread's title bar carries at its end (ADR-124, ADR-125): the pin when it is pinned,
 * and on a desktop the "⋯". A phone keeps its "⋯" in the window's top row instead, the only
 * place it has for one. Nothing until the shell is ready.
 */
export function ThreadHeaderActions({ thread }: { thread: ThreadSummary }) {
  const shell = useShell();
  const { isMobile } = useSidebar();
  if (shell === null) return null;
  return (
    <>
      {thread.pinnedAt !== null && <PinnedMark shell={shell} thread={thread} />}
      {!isMobile && <ThreadMenuButton shell={shell} thread={thread} />}
    </>
  );
}
