import { Globe, LayoutDashboard, MessageSquareText, type LucideIcon } from "lucide-react";
import type { PaneKind } from "./state";

/** Each layout's name and glyph; the tab's icon and the layout switch read the same table. */
export const LAYOUTS = {
  thread: { label: "Thread", Icon: MessageSquareText },
  canvas: { label: "Canvas", Icon: LayoutDashboard },
  browser: { label: "Browser", Icon: Globe },
} as const satisfies Record<PaneKind, { label: string; Icon: LucideIcon }>;

/** The layouts in the order the switch offers them. */
export const PANES: PaneKind[] = ["thread", "canvas", "browser"];
