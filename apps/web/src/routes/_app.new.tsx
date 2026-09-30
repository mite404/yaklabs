import { useEffect, useRef } from "react";
import { Navigate, useLocation } from "react-router";
import { useShell } from "../shell/model";
import { RuntimePending } from "../shell/pending";

export function meta() {
  return [{ title: "New thread" }];
}

// The slate's data: the runtime's empty scenario, held in memory, so no starter project, no
// seeded thread and no fixture's child is on screen, only what this visit starts.
const SLATE = "empty";
const PARAM = "scenario";

// Whether the address already asks for the slate's data.
const onSlate = (search: string): boolean => new URLSearchParams(search).get(PARAM) === SLATE;

/**
 * A blank slate for trying the live agent: the whole shell on an empty workspace, with one new
 * thread started on arrival, so the first thing on screen is that thread's welcome and its
 * compose box. Nothing persists: the empty scenario lives in memory, so a reload starts over,
 * and a thread's address under it does not survive one either. The device's own threads stay
 * under `/` and `/t/:threadId`.
 */
export default function NewThread() {
  const { search } = useLocation();
  const shell = useShell();
  const started = useRef(false); // → once per visit, StrictMode's second mount included
  const ready = onSlate(search) && shell !== null;
  useEffect(() => {
    if (!ready || started.current) return;
    started.current = true;
    shell.newThread();
  }, [ready, shell]);
  if (!onSlate(search)) return <Navigate replace to={`/new?${PARAM}=${SLATE}`} />;
  return <RuntimePending />;
}
