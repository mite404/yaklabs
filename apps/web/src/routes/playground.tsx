import { Playground } from "../playground/Playground";
import { RequireSession } from "../session";

export function meta() {
  return [{ title: "Playground" }];
}

/**
 * The live playground (ADR-148), a standalone route outside `_app`'s runtime: it talks to the
 * gateway directly and keeps nothing. Sign-in guards it wherever the build has sign-in.
 */
export default function PlaygroundRoute() {
  return (
    <RequireSession>
      <Playground />
    </RequireSession>
  );
}
