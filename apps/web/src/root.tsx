import { AuthKitProvider } from "@workos-inc/authkit-react";
import { trackInputModality } from "@yaklabs/catalog/inputModality";
import { Toaster } from "@yaklabs/ui/components/sonner";
import { TooltipProvider } from "@yaklabs/ui/components/tooltip";
import { useEffect, type ReactNode } from "react";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useNavigate,
} from "react-router";

import "./index.css";
import type { Route } from "./+types/root";
import Rail from "./components/rail";
import { env } from "./env";
import { safeReturnTo } from "./returnTo";
import { THEME_BOOT, useTheme } from "./theme";

export function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

// WorkOS AuthKit in the browser (ADR-084); the provider also finishes the sign-in when the
// callback route loads with a code. Dev mode keeps tokens in localStorage on localhost only.
function Providers({ children }: { children: ReactNode }) {
  const navigate = useNavigate();
  if (env.auth.kind === "none") return children;
  return (
    <AuthKitProvider
      clientId={env.auth.clientId}
      redirectUri={env.auth.redirectUri}
      devMode={window.location.hostname === "localhost"}
      onRedirectCallback={({ state }) =>
        void navigate(safeReturnTo(state, window.location.origin), { replace: true })
      }
    >
      {children}
    </AuthKitProvider>
  );
}

export default function App() {
  const [preference, setPreference] = useTheme();
  useEffect(() => trackInputModality(), []);
  return (
    <Providers>
      <TooltipProvider>
        <div className="grid h-svh grid-cols-[auto_1fr] overflow-hidden">
          <Rail onTheme={setPreference} />
          <Outlet />
        </div>
      </TooltipProvider>
      <Toaster richColors theme={preference} />
    </Providers>
  );
}

export function ErrorBoundary({ error }: Route.ErrorBoundaryProps) {
  // React Router's own overlay carries the stack in development; the page stays plain.
  const missing = isRouteErrorResponse(error) && error.status === 404;
  return (
    <main className="container mx-auto p-4 pt-16">
      <h1>{missing ? "Page not found" : "Something went wrong"}</h1>
      <p>{missing ? "There is nothing at this address." : "Reload the page to try again."}</p>
    </main>
  );
}
