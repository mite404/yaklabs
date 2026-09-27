import { badgeVariants } from "@yaklabs/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { cn } from "@yaklabs/ui/lib/utils";
import { useId } from "react";
import { env } from "../env";
import { useRuntimeState } from "../runtime";
import { markerFor } from "../source";

/**
 * Where the data on screen lives and who answers (ADR-096), from the runtime's own word. The
 * label drawn as a badge is a button so focus has a role, and its hint, which the tooltip shows
 * only to the eye, is also its accessible description.
 */
export function DataMarker() {
  const state = useRuntimeState();
  const hintId = useId();
  const marker = markerFor(state.source, env.agent);
  if (marker === null) return null;
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          aria-describedby={hintId}
          className={cn(
            badgeVariants({ variant: "outline" }),
            "h-6 min-w-0 shrink rounded-[var(--radius)] border-hairline px-2 text-xs font-normal text-soft-ink",
          )}
        >
          <span data-slot="data-marker" className="truncate">
            <span className="max-md:sr-only">{marker.label}</span>
            <span aria-hidden="true" className="md:hidden">
              {marker.short}
            </span>
          </span>
        </TooltipTrigger>
        <TooltipContent side="bottom">{marker.hint}</TooltipContent>
      </Tooltip>
      <span id={hintId} hidden>
        {marker.hint}
      </span>
    </>
  );
}
