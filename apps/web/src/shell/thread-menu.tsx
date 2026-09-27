import type { ProjectId, ThreadId, Workspace } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@yaklabs/ui/components/dropdown-menu";
import { Ellipsis } from "lucide-react";
import type { Shell } from "./model";

// The project a main thread lives in, or null when the thread is not a main in the workspace.
function projectOf(ws: Workspace, main: ThreadId): { id: ProjectId; name: string } | null {
  const thread = ws.threads.find((each) => each.id === main); // → ThreadSummary | undefined
  if (thread?.place.kind !== "main") return null;
  const { projectId } = thread.place;
  return ws.projects.find((each) => each.id === projectId) ?? null; // → Project | null
}

/** The name of the project the thread on screen belongs to, or null with nothing on screen. */
export function activeProjectName(shell: Shell | null): string | null {
  if (shell === null || shell.active === null) return null;
  return projectOf(shell.workspace, shell.active.main)?.name ?? null;
}

/**
 * The phone bar's "⋯": what can be done to the thread on screen and its project, which on a
 * desktop live in the tab strip and the sidebar (ADR-116).
 */
export function ThreadMenu({ shell }: { shell: Shell | null }) {
  const active = shell?.active?.main ?? null;
  const project = shell === null || active === null ? null : projectOf(shell.workspace, active);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        disabled={shell === null}
        render={
          <Button
            variant="ghost"
            size="icon"
            aria-label="Thread and project actions"
            className="rounded-[var(--radius)] text-soft-ink hover:text-ink md:hidden"
          />
        }
      >
        <Ellipsis aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{project?.name ?? "Threads"}</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              shell?.newThread(project?.id);
            }}
          >
            New thread
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={active === null}
            onClick={() => {
              if (active !== null) shell?.close(active);
            }}
          >
            Close this thread
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            shell?.newProject();
          }}
        >
          New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
