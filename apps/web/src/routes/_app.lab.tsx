import { App as Workbench } from "@yaklabs/catalog";
import { usePaths } from "../runtime";

export function meta() {
  return [{ title: "Catalog lab" }];
}

/** The evaluation workbench: fixtures through the same validation as the thread. */
export default function LabPage() {
  const { hrefTo } = usePaths();
  return <Workbench home={hrefTo("/")} />;
}
