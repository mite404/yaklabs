import { ToggleGroup, ToggleGroupItem } from "@yaklabs/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { LAYOUTS, PANES } from "./layouts";
import type { Shell } from "./model";
import { viewOf } from "./state";

/** Thread, Browser or Canvas beside the active tab's thread; nothing to switch with no tab. */
export function LayoutSwitch({ shell }: { shell: Shell | null }) {
  const main = shell?.active?.main ?? null;
  const pane = shell !== null && main !== null ? viewOf(shell.doc, main).pane : null;
  return (
    <ToggleGroup
      aria-label="Layout"
      spacing={0}
      value={pane === null ? [] : [pane]}
      disabled={pane === null}
      onValueChange={(values: unknown[]) => {
        const next = PANES.find((each) => values.includes(each));
        if (shell !== null && main !== null && next !== undefined) shell.setPane(main, next);
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
