import { LinkIcon } from "@yaklabs/catalog/icons";
import type { ThreadSummary } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@yaklabs/ui/components/dropdown-menu";
import { useSidebar } from "@yaklabs/ui/components/sidebar";
import { Archive, ArchiveRestore, Ellipsis, Pencil, Pin, PinOff, Trash2 } from "lucide-react";
import type { ComponentProps } from "react";
import { useShell, type Shell } from "./model";
import { ShareItem, ThreadShareButton } from "./share-menu";
import { SnoozeItem } from "./snooze-item";

/** The label every "⋯" for a thread carries, in its title bar or the phone's (ADR-126). */
export const THREAD_ACTIONS = "Thread actions";

// What each item acts on: the shell's verbs and the thread.
type ItemProps = { shell: Shell; thread: ThreadSummary };

// Pin names what it would do now: Pin thread, or Unpin thread (ADR-127).
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

// Archive names what it would do now: Archive, or Unarchive (ADR-129).
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
 * The thread menu's items (ADR-126), in Ethan's order: Copy thread URL, Share thread, Pin,
 * Snooze, Archive, then Delete apart. Pin and Archive name what they would do now. Delete keeps
 * ink for its words, which the red does not clear on a dark menu (ADR-065); its icon is red.
 * @param beforeSnooze Runs before the snooze card opens, to bring the thread into view.
 * @param onRename When set, Rename leads the menu and calls this; a tab uses it to open its
 * title as a field.
 */
export function ThreadActionsContent({
  shell,
  thread,
  beforeSnooze,
  onRename,
  ...props
}: ItemProps & {
  beforeSnooze?: () => void;
  onRename?: () => void;
} & ComponentProps<typeof DropdownMenuContent>) {
  return (
    <DropdownMenuContent align="end" className="w-64" {...props}>
      <DropdownMenuGroup>
        {onRename !== undefined && (
          <DropdownMenuItem onClick={onRename}>
            <Pencil aria-hidden="true" />
            Rename
          </DropdownMenuItem>
        )}
        <DropdownMenuItem
          onClick={() => {
            shell.copyUrl(thread.id);
          }}
        >
          <LinkIcon />
          Copy thread URL
        </DropdownMenuItem>
        <ShareItem shell={shell} thread={thread} />
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

// The "⋯" in a lane thread's own title bar, on a desktop. It shows while the bar is hovered or
// holds focus, and while its menu is open (index.css keys on data-thread-menu); it is only
// faded out, so it stays in the tab order and the accessibility tree.
function ThreadMenuButton({ shell, thread }: { shell: Shell; thread: ThreadSummary }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label={THREAD_ACTIONS}
            data-thread-menu=""
            className="text-soft-ink hover:text-ink"
          />
        }
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenuTrigger>
      <ThreadActionsContent shell={shell} thread={thread} />
    </DropdownMenu>
  );
}

/**
 * What a lane thread's title bar carries before its close (ADR-126): the "⋯" and Share, on a
 * desktop. A phone keeps its "⋯" in the window's top row instead, the only place it has for one,
 * and a main thread's is on its tab. Nothing until the shell is ready.
 */
export function ThreadHeaderActions({ thread }: { thread: ThreadSummary }) {
  const shell = useShell();
  const { isMobile } = useSidebar();
  if (shell === null || isMobile) return null;
  return (
    <>
      <ThreadMenuButton shell={shell} thread={thread} />
      <ThreadShareButton shell={shell} thread={thread} />
    </>
  );
}
