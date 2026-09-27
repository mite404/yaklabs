import type { ThreadId } from "@yaklabs/runtime";
import { ToggleGroup, ToggleGroupItem } from "@yaklabs/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { LAYOUTS, PANES } from "./layouts";
import type { Shell } from "./model";
import { viewOf, type PaneKind } from "./state";

// The tab on screen and what sits beside its thread, or null with no tab on screen.
function shownPane(shell: Shell): { main: ThreadId; pane: PaneKind } | null {
  if (shell.active === null) return null;
  const { main } = shell.active;
  return { main, pane: viewOf(shell.doc, main).pane };
}

/** Thread, Browser or Canvas beside the active tab's thread; nothing to switch with no tab. */
export function LayoutSwitch({ shell }: { shell: Shell | null }) {
  const shown = shell === null ? null : shownPane(shell);
  return (
    <ToggleGroup
      aria-label="Layout"
      spacing={0}
      value={shown === null ? [] : [shown.pane]}
      disabled={shown === null}
      onValueChange={(values: unknown[]) => {
        const next = PANES.find((each) => values.includes(each));
        if (shown !== null && next !== undefined) shell?.setPane(shown.main, next);
      }}
      className="rounded-[var(--radius)] border border-hairline p-0.5"
    >
      {PANES.map((each) => {
        const { label, Icon } = LAYOUTS[each];
        return (
          <Tooltip key={each}>
            <TooltipTrigger
              render={
                <ToggleGroupItem
                  value={each}
                  aria-label={label}
                  className="size-7 min-w-7 rounded-[3px] px-0 text-soft-ink hover:text-ink"
                />
              }
            >
              <Icon aria-hidden="true" />
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
          </Tooltip>
        );
      })}
    </ToggleGroup>
  );
}
