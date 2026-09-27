import { Badge } from "@yaklabs/ui/components/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { env } from "../env";
import { useRuntimeState } from "../runtime";
import { markerFor } from "../source";

/** Where the data on screen lives and who answers (ADR-096), from the runtime's own word. */
export function DataMarker() {
  const state = useRuntimeState();
  const marker = markerFor(state.source, env.agent);
  if (marker === null) return null;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Badge
            tabIndex={0}
            variant="outline"
            className="h-6 min-w-0 shrink rounded-[var(--radius)] border-hairline px-2 text-xs font-normal text-soft-ink"
          />
        }
      >
        <span data-slot="data-marker" className="truncate">
          {marker.label}
        </span>
      </TooltipTrigger>
      <TooltipContent side="bottom">{marker.hint}</TooltipContent>
    </Tooltip>
  );
}
