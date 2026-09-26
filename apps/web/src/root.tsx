import { Toaster } from "@yaklabs/ui/components/sonner";
import {
  isRouteErrorResponse,
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "react-router";

import "./index.css";
import type { Route } from "./+types/root";
import Header from "./components/header";
import { ThemeProvider } from "./components/theme-provider";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

export function Layout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <Meta />
        <Links />
      </head>
      <body>
        {children}
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}

export default function App() {
  return (
    <ThemeProvider
      attribute="data-theme"
      defaultTheme="light"
      disableTransitionOnChange
      storageKey="theme"
    >
      <div className="grid grid-rows-[auto_1fr] h-svh">
        <Header />
        <Outlet />
      </div>
      <Toaster richColors />
    </ThemeProvider>
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
