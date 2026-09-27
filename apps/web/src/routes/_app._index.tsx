import { Button } from "@yaklabs/ui/components/button";
import { Navigate } from "react-router";
import { usePaths } from "../runtime";
import { useShell } from "../shell/model";
import { Notice, RuntimePending } from "../shell/pending";

export function meta() {
  return [{ title: "Kay" }];
}

/** Home: the tab last on screen, else the open tab with the newest activity, else nothing. */
export default function Home() {
  const shell = useShell();
  const { pathTo } = usePaths();
  if (shell === null) return <RuntimePending />;
  if (shell.resumeTo !== null) return <Navigate replace to={pathTo(shell.resumeTo)} />;
  return (
    <Notice title="Nothing open">
      <p className="text-sm text-soft-ink">Open a thread from the sidebar, or start one.</p>
      <Button
        variant="outline"
        size="sm"
        className="rounded-[var(--radius)]"
        onClick={() => {
          shell.newThread();
        }}
      >
        Start a thread
      </Button>
    </Notice>
  );
}
