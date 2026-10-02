import { Button } from "@yaklabs/ui/components/button";
import type { ComponentProps } from "react";

/**
 * The page's own quiet action, such as Try again, New project or Start a thread: shadcn's
 * outline button at the site's 4px corners.
 */
export function QuietButton(
  props: Omit<ComponentProps<typeof Button>, "variant" | "size" | "className">,
) {
  return <Button variant="outline" size="sm" {...props} />;
}
