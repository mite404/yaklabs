import { latestMain, type ThreadId, type Workspace } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@yaklabs/ui/components/resizable";
import { trackHintLine } from "../components/divider";
import { MainCanvas } from "../components/main-canvas";
import { ThreadPane } from "../components/thread-pane";
import { useRestart, useRuntimeState } from "../runtime";

export function meta() {
  return [{ title: "Kay" }];
}

// The main thread beside its canvas; the divider between them drags anywhere along its length.
function MainAndCanvas({ main, workspace }: { main: ThreadId; workspace: Workspace }) {
  const thread = workspace.threads.find((each) => each.id === main);
  if (thread === undefined) return null;
  return (
    <ResizablePanelGroup orientation="horizontal" className="h-full">
      {/* Strings are percentages to the panel library; a bare number would be pixels. */}
      <ResizablePanel defaultSize="52" minSize="28">
        <div
          className="flex h-full min-w-0 justify-center p-4"
          style={{ ["--thread-height" as string]: "100%" }}
        >
          <ThreadPane key={thread.id} thread={thread} />
        </div>
      </ResizablePanel>
      {/* Above the panes, so nothing positioned in them can cover its hit area. */}
      <ResizableHandle
        aria-label="Resize the thread and the canvas"
        className="drag-hint z-10"
        onPointerMove={trackHintLine}
      />
      <ResizablePanel minSize="20">
        <MainCanvas main={main} workspace={workspace} />
      </ResizablePanel>
    </ResizablePanelGroup>
  );
}

/** The latest main thread and, beside it, its compose canvas (ADR-089, ADR-092). */
export default function ThreadPage() {
  const state = useRuntimeState();
  const restart = useRestart();
  if (state.kind === "starting") {
    return <p className="p-4 text-soft-ink">Opening your threads…</p>;
  }
  if (state.kind === "broken") {
    return (
      <div className="p-4">
        <p className="text-ink">Your threads could not be opened.</p>
        <p className="text-sm text-soft-ink">{state.reason}</p>
        {restart && (
          <Button variant="outline" size="sm" onClick={restart}>
            Try again
          </Button>
        )}
      </div>
    );
  }
  const { source, workspace } = state;
  const main = latestMain(workspace);
  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)]">
      {source.kind === "device" && source.storage === "memory" ? (
        <output className="px-4 pt-2 text-sm text-soft-ink">
          This browser cannot keep conversations, so this one lasts until the tab closes.
        </output>
      ) : (
        <span />
      )}
      {main === undefined ? (
        <p className="p-4 text-soft-ink">Nothing open.</p>
      ) : (
        <MainAndCanvas main={main} workspace={workspace} />
      )}
    </div>
  );
}
