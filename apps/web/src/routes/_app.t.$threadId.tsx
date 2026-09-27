import { Link } from "react-router";
import { usePaths } from "../runtime";
import { useShell } from "../shell/model";
import { Notice, RuntimePending } from "../shell/pending";

export function meta() {
  return [{ title: "Kay" }];
}

/**
 * A thread by its id, main or child (ADR-092). The deck draws its tab; this route draws only
 * what is not a tab: the runtime starting or broken, or an id no thread has.
 */
export default function ThreadRoute() {
  const shell = useShell();
  const { hrefTo } = usePaths();
  if (shell === null) return <RuntimePending />;
  if (shell.active !== null) return null;
  return (
    <Notice title="This thread is gone">
      <Link to={hrefTo("/")} className="text-sm text-soft-ink underline underline-offset-4">
        Back to your threads
      </Link>
    </Notice>
  );
}
