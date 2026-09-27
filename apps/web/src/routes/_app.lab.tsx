import { App as Workbench } from "@yaklabs/catalog";

export function meta() {
  return [{ title: "Catalog lab" }];
}

/** The evaluation workbench: fixtures through the same validation as the thread. */
export default function LabPage() {
  return <Workbench />;
}
