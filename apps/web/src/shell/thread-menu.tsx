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
import { threadActions } from "./state";

/** The name of the project on screen, where a phone's bar shows it in place of the tabs. */
export function ProjectName({ shell }: { shell: Shell | null }) {
  return (
    <span
      data-slot="project-name"
      className="min-w-0 truncate px-1 text-sm font-medium text-ink md:hidden"
    >
      {shell === null ? null : threadActions(shell.workspace, shell.active).name}
    </span>
  );
}

// The "⋯" itself, which only a phone shows.
function MoreTrigger({ disabled }: { disabled: boolean }) {
  return (
    <DropdownMenuTrigger
      disabled={disabled}
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
  );
}

// The menu once the shell is ready: the thread on screen and its project.
function MoreMenu({ shell }: { shell: Shell }) {
  const actions = threadActions(shell.workspace, shell.active);
  return (
    <DropdownMenu>
      <MoreTrigger disabled={false} />
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuGroup>
          <DropdownMenuLabel>{actions.name ?? "Threads"}</DropdownMenuLabel>
          <DropdownMenuItem
            onClick={() => {
              shell.newThread(actions.projectId);
            }}
          >
            New thread
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={actions.closes === null}
            onClick={() => {
              if (actions.closes !== null) shell.close(actions.closes);
            }}
          >
            Close this thread
          </DropdownMenuItem>
        </DropdownMenuGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => {
            shell.newProject();
          }}
        >
          New project
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/**
 * The phone bar's "⋯": what can be done to the thread on screen and its project, which on a
 * desktop live in the tab strip and the sidebar (ADR-116).
 */
export function ThreadMenu({ shell }: { shell: Shell | null }) {
  if (shell === null) {
    return (
      <DropdownMenu>
        <MoreTrigger disabled />
      </DropdownMenu>
    );
  }
  return <MoreMenu shell={shell} />;
}
