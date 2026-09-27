import { Outlet } from "react-router";
import { RuntimeProvider } from "../runtime";
import { RequireSession } from "../session";

/**
 * Everything under here needs a signed-in visitor when the build has sign-in (ADR-084), and
 * shares one runtime for as long as the visitor stays (ADR-076).
 */
export default function Protected() {
  return (
    <RequireSession>
      <RuntimeProvider>
        <Outlet />
      </RuntimeProvider>
    </RequireSession>
  );
}
