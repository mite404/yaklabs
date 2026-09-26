import { Button } from "@yaklabs/ui/components/button";
import { Plus, X } from "lucide-react";
import { useState, type DragEvent, type ReactNode } from "react";
import { accepts, readDrop, type Drop } from "../canvas";

/** One lane on the canvas: what it is called and what it shows. */
export type LaneView = { id: string; title: string; node: ReactNode };

// The lanes stand in a row; each is a fixed column so the thread inside keeps one measure.
const LANE_CLASS = "flex h-full w-[min(560px,80vw)] shrink-0 flex-col";

function Lane({ lane, onClose }: { lane: LaneView; onClose: (id: string) => void }) {
  return (
    <article className={LANE_CLASS} aria-label={lane.title}>
      <div className="flex h-8 items-center justify-end">
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Close ${lane.title}`}
          onClick={() => {
            onClose(lane.id);
          }}
        >
          <X />
        </Button>
      </div>
      <div className="min-h-0 flex-1" style={{ ["--thread-height" as string]: "100%" }}>
        {lane.node}
      </div>
    </article>
  );
}

// The open space at the end of the row: the whole canvas when it is empty, a slimmer
// column once lanes exist, so there is always somewhere to drop the next thing.
function OpenSpace({
  empty,
  over,
  onBlank,
}: {
  empty: boolean;
  over: boolean;
  onBlank: () => void;
}) {
  return (
    <div
      className={`flex h-full min-w-[320px] flex-1 flex-col items-center justify-center gap-3 rounded-[var(--radius-card)] border border-dashed p-6 text-center transition-colors ${
        over ? "border-olive bg-paper-deep/60" : "border-hairline"
      }`}
    >
      <p className="max-w-[28ch] font-serif text-xl text-ink">
        {empty ? "Drag a highlight here to start a new thread" : "Drop here for another lane"}
      </p>
      <p className="max-w-[36ch] text-sm text-soft-ink">
        {empty
          ? "Select any text in the thread and pull it over, or drag a card by its header to see it large."
          : "A highlight starts a thread; a card opens large."}
      </p>
      <Button variant="outline" size="sm" onClick={onBlank}>
        <Plus data-icon="inline-start" />
        Blank thread
      </Button>
    </div>
  );
}

/**
 * The compose canvas (ADR-089): a row of lanes that grows to the right, with open space at
 * the end that takes the next drop. A highlight from a thread starts a new thread there; a
 * card dragged by its header opens large.
 */
export function Canvas({
  lanes,
  onDrop,
  onClose,
  onBlank,
}: {
  lanes: LaneView[];
  onDrop: (drop: Drop) => void;
  onClose: (id: string) => void;
  onBlank: () => void;
}) {
  const [over, setOver] = useState(false);

  function dragOver(event: DragEvent<HTMLElement>) {
    if (!accepts(event.dataTransfer)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setOver(true);
  }

  function drop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    setOver(false);
    const dropped = readDrop(event.dataTransfer); // → Drop | undefined
    if (dropped) onDrop(dropped);
  }

  return (
    // oxlint-disable-next-line jsx-a11y/no-noninteractive-element-interactions -- a drop target has no interactive role; the keyboard path is the Blank thread button
    <section
      aria-label="Compose canvas"
      className="canvas flex h-full gap-4 overflow-x-auto p-4"
      onDragOver={dragOver}
      onDragLeave={() => {
        setOver(false);
      }}
      onDrop={drop}
    >
      {lanes.map((lane) => (
        <Lane key={lane.id} lane={lane} onClose={onClose} />
      ))}
      <OpenSpace empty={lanes.length === 0} over={over} onBlank={onBlank} />
    </section>
  );
}
