import type { ThreadId } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import { Popover, PopoverContent, PopoverTrigger } from "@yaklabs/ui/components/popover";
import { ToggleGroup, ToggleGroupItem } from "@yaklabs/ui/components/toggle-group";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { useState } from "react";
import { LAYOUTS, PANES } from "./layouts";
import type { Shell } from "./model";
import { viewOf, type PaneKind } from "./state";

// The tab on screen and what sits beside its thread, or null with no tab on screen.
function shownPane(shell: Shell): { main: ThreadId; pane: PaneKind } | null {
  if (shell.active === null) return null;
  const { main } = shell.active;
  return { main, pane: viewOf(shell.doc, main).pane };
}

// The Thread/Browser/Canvas group itself: the bar shows it inline, the phone popover shows the
// same group once opened, so the accessible names never differ between the two.
function LayoutGroup({
  shown,
  shell,
  className,
  onChosen,
}: {
  shown: { main: ThreadId; pane: PaneKind } | null;
  shell: Shell | null;
  className?: string;
  onChosen?: () => void;
}) {
  return (
    <ToggleGroup
      aria-label="Layout"
      spacing={0.5}
      value={shown === null ? [] : [shown.pane]}
      disabled={shown === null}
      onValueChange={(values: unknown[]) => {
        const next = PANES.find((each) => values.includes(each));
        if (shown !== null && next !== undefined) shell?.setPane(shown.main, next);
        onChosen?.();
      }}
      className={`rounded-[var(--radius)] border border-hairline p-0.5 ${className ?? ""}`}
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

/**
 * Thread, Browser or Canvas beside the active tab's thread; nothing to switch with no tab. At
 * desktop width this is the group in the bar; below it, one icon button opens the same group in
 * a popover, closing once a choice is made.
 */
export function LayoutSwitch({ shell }: { shell: Shell | null }) {
  const shown = shell === null ? null : shownPane(shell);
  const [open, setOpen] = useState(false);
  const { Icon } = LAYOUTS[shown?.pane ?? "thread"];
  return (
    <>
      <LayoutGroup shown={shown} shell={shell} className="max-md:hidden" />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          disabled={shown === null}
          render={
            <Button
              variant="ghost"
              size="icon"
              aria-label="Layout"
              className="rounded-[var(--radius)] text-soft-ink hover:text-ink md:hidden"
            />
          }
        >
          <Icon aria-hidden="true" />
        </PopoverTrigger>
        <PopoverContent side="bottom" align="end" className="w-auto min-w-0 p-1.5">
          <LayoutGroup
            shown={shown}
            shell={shell}
            onChosen={() => {
              setOpen(false);
            }}
          />
        </PopoverContent>
      </Popover>
    </>
  );
}
