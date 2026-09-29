import WeeklyBriefDemo from "../demo/WeeklyBriefDemo";

export function meta() {
  return [{ title: "Weekly brief · Scripted demo" }];
}

/**
 * A standalone demo route (ADR-137 through ADR-140), outside `_app`'s runtime: no session, no
 * shared workspace, no persisted thread. Everything it shows lives in `../demo`.
 */
export default function DemoWeeklyBriefRoute() {
  return <WeeklyBriefDemo />;
}
