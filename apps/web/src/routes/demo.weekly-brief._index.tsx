import { Navigate } from "react-router";
import { mainIdOf } from "../demo/runtime";
import { useDemo } from "../demo/provider";
import { usePaths } from "../runtime";

/** The demo's home: its main thread, at once, so the scenario opens on its thread. */
export default function DemoHome() {
  const { script } = useDemo();
  const { pathTo } = usePaths();
  return <Navigate replace to={pathTo(mainIdOf(script))} />;
}
