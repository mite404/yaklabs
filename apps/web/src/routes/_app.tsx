import { Outlet, useOutletContext } from "react-router";
import { RuntimeProvider } from "../runtime";
import { RequireSession } from "../session";
import { Deck } from "../shell/deck";
import { ShellProvider, useShell } from "../shell/model";
import { Window } from "../shell/window";
import type { ThemeChoice } from "../theme";

// The route's own page, drawn only while no tab is on screen. The deck shows the tab an address
// is on its way to at once, and the router keeps the page it is leaving until the next route
// has loaded, so a page left for a thread (the Lab) would otherwise draw under the new tab.
function Page() {
  const shell = useShell();
  return shell !== null && shell.active !== null ? null : <Outlet />;
}

/**
 * Everything under here needs a signed-in visitor when the build has sign-in (ADR-084), and
 * shares one runtime for as long as the visitor stays (ADR-076). The window's workspace holds
 * the deck of open tabs and the route in one grid cell, one or the other: the route draws only
 * while no tab is on screen.
 */
export default function Protected() {
  const theme = useOutletContext<ThemeChoice>();
  return (
    <RequireSession>
      <RuntimeProvider>
        <ShellProvider>
          <Window theme={theme}>
            <Deck />
            <Page />
          </Window>
        </ShellProvider>
      </RuntimeProvider>
    </RequireSession>
  );
}
