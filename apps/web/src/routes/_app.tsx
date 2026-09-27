import { Outlet, useOutletContext } from "react-router";
import { RuntimeProvider } from "../runtime";
import { RequireSession } from "../session";
import { Deck } from "../shell/deck";
import { ShellProvider } from "../shell/model";
import { Window } from "../shell/window";
import type { ThemeChoice } from "../theme";

/**
 * Everything under here needs a signed-in visitor when the build has sign-in (ADR-084), and
 * shares one runtime for as long as the visitor stays (ADR-076). The window's workspace holds
 * the deck of open tabs and the route in one grid cell: the route draws only what is not a tab.
 */
export default function Protected() {
  const theme = useOutletContext<ThemeChoice>();
  return (
    <RequireSession>
      <RuntimeProvider>
        <ShellProvider>
          <Window theme={theme}>
            <Deck />
            <Outlet />
          </Window>
        </ShellProvider>
      </RuntimeProvider>
    </RequireSession>
  );
}
