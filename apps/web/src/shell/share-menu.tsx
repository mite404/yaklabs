import type { ThreadShare, ThreadSummary } from "@yaklabs/runtime";
import {
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@yaklabs/ui/components/dropdown-menu";
import { ExternalLink, Link, Share2, Timer, X } from "lucide-react";
import { MenuStatus, statusName } from "./menu-status";
import type { Shell } from "./model";
import { LIFETIMES } from "./share-thread";
import { wakeText } from "./wake-text";

// What the submenu acts on: the shell's verbs and the thread.
type ShareProps = { shell: Shell; thread: ThreadSummary };

// The thread's live share, the newest one, if its time has not run out.
function liveShare(shell: Shell, thread: ThreadSummary): ThreadShare | undefined {
  const latest = shell.workspace.shares.find((share) => share.threadId === thread.id);
  return latest !== undefined && Date.parse(latest.expiresAt) > Date.now() ? latest : undefined;
}

// What a public thread's page offers: its end, its link, and taking it down.
function PublicItems({ shell, thread, share }: ShareProps & { share: ThreadShare }) {
  return (
    <>
      <DropdownMenuGroup>
        <DropdownMenuLabel>
          Public until {wakeText(new Date(share.expiresAt), "row")}
        </DropdownMenuLabel>
        <DropdownMenuItem
          onClick={() => {
            shell.copyPublicLink(thread.id);
          }}
        >
          <Link aria-hidden="true" />
          Copy public link
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            window.open(share.link, "_blank", "noopener");
          }}
        >
          <ExternalLink aria-hidden="true" />
          Open public page
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            shell.stopSharing(thread.id);
          }}
        >
          <X aria-hidden="true" />
          Stop sharing
        </DropdownMenuItem>
      </DropdownMenuGroup>
      <DropdownMenuSeparator />
    </>
  );
}

// How long to make it public: each lifetime starts a new link, in place of any old one.
function LifetimeItems({ shell, thread, isPublic }: ShareProps & { isPublic: boolean }) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{isPublic ? "New link, public for" : "Make public for"}</DropdownMenuLabel>
      {LIFETIMES.map(({ label, seconds }) => (
        <DropdownMenuItem
          key={seconds}
          onClick={() => {
            shell.share(thread.id, seconds);
          }}
        >
          <Timer aria-hidden="true" />
          {label}
        </DropdownMenuItem>
      ))}
    </DropdownMenuGroup>
  );
}

/**
 * The thread menu's Share item (ADR-131): it says whether the thread is private or public
 * until when, and opens how long to make it public (1 hour, 3 hours, 1 day, 7 days). A public
 * thread also offers its link, its page, and Stop sharing, so how long a page stays public is
 * never a guess.
 */
export function ShareItem({ shell, thread }: ShareProps) {
  const share = liveShare(shell, thread);
  const status =
    share === undefined ? "Private" : `Until ${wakeText(new Date(share.expiresAt), "menu")}`;
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger
        className="whitespace-nowrap"
        aria-label={statusName("Share thread", status)}
      >
        <Share2 aria-hidden="true" />
        Share thread
        <MenuStatus>{status}</MenuStatus>
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-56">
        {share !== undefined && <PublicItems shell={shell} thread={thread} share={share} />}
        <LifetimeItems shell={shell} thread={thread} isPublic={share !== undefined} />
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  );
}
