import { Navigate } from "react-router";

/** The standalone playground is gone: the live model answers its thread in the shell. */
export default function PlaygroundRoute() {
  return <Navigate replace to="/t/playground" />;
}
