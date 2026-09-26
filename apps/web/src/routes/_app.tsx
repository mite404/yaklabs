import { Outlet } from "react-router";
import { RequireSession } from "../session";

/** Everything under here needs a signed-in visitor when the build has sign-in (ADR-084). */
export default function Protected() {
  return (
    <RequireSession>
      <Outlet />
    </RequireSession>
  );
}
