import { useAuth } from "@workos-inc/authkit-react";
import { useEffect, type ReactNode } from "react";
import { env } from "./env";

/** What the runtime needs from a signed-in visitor: a fresh access token for the gateway. */
export type Session = { getAccessToken(): Promise<string> };

// Sends signed-out visitors to WorkOS's hosted sign-in and shows nothing of the app until
// they are back (ADR-084). The path they wanted rides along in `state`.
function WorkOsGate({ children }: { children: ReactNode }) {
  const { isLoading, user, signIn } = useAuth();
  useEffect(() => {
    if (!isLoading && user === null) void signIn({ state: { returnTo: window.location.pathname } });
  }, [isLoading, user, signIn]);
  if (user === null) return <p className="p-4 text-soft-ink">Signing you in…</p>;
  return children;
}

function OpenGate({ children }: { children: ReactNode }) {
  return children;
}

function useWorkOsSession(): Session {
  const { getAccessToken } = useAuth();
  return { getAccessToken: () => getAccessToken() };
}

function useNoSession(): Session | undefined {
  return undefined;
}

/** Wraps every protected route: a pass-through without sign-in, the WorkOS gate with it. */
export const RequireSession = env.auth.kind === "workos" ? WorkOsGate : OpenGate;

/** The visitor's session, or undefined when the build has no sign-in. */
export const useSession = env.auth.kind === "workos" ? useWorkOsSession : useNoSession;
