import { useLocation } from "react-router";

/**
 * What the rail's Home link carries to "/": a request for the hub, the greeting and the
 * projects, rather than the tab last on screen that a plain visit to "/" resumes.
 */
export const HOME_HUB = { hub: true } as const;

// Whether a navigation's state is Home's request for the hub.
const asksForHub = (state: unknown): boolean =>
  typeof state === "object" && state !== null && "hub" in state && state.hub === true;

/** Whether this visit to "/" came from Home and should show the hub. */
export function useHubAsked(): boolean {
  return asksForHub(useLocation().state);
}
