import { Outlet } from "react-router";
import { RuntimeProvider } from "../runtime";
import { RequireSession } from "../session";
import { Deck } from "../shell/deck";
import { ShellProvider } from "../shell/model";

/**
 * Everything under here needs a signed-in visitor when the build has sign-in (ADR-084), and
 * shares one runtime for as long as the visitor stays (ADR-076). The deck of open tabs and the
 * route share one grid cell: the route draws only what is not a tab.
 */
export default function Protected() {
  return (
    <RequireSession>
      <RuntimeProvider>
        <ShellProvider>
          <div className="grid h-full min-h-0 min-w-0 *:[grid-area:1/1]">
            <Deck />
            <Outlet />
          </div>
        </ShellProvider>
      </RuntimeProvider>
    </RequireSession>
  );
}
