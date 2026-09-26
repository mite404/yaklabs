import { ChatThreadPanel } from "@yaklabs/catalog";
import { threads } from "@yaklabs/catalog/thread";

export function meta() {
  return [{ title: "Kay" }];
}

/** The thread: the profit card with its stepped slider, answered by the agent (ADR-029). */
export default function ThreadPage() {
  return (
    <div
      className="flex justify-center overflow-hidden p-4"
      style={{ ["--thread-height" as string]: "calc(100svh - 80px)" }}
    >
      <ChatThreadPanel thread={threads.profit} />
    </div>
  );
}
