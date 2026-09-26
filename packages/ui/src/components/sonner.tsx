"use client";

import {
  CircleCheckIcon,
  InfoIcon,
  Loader2Icon,
  OctagonXIcon,
  TriangleAlertIcon,
} from "lucide-react";
import { useTheme } from "next-themes";
import { Toaster as Sonner, type ToasterProps } from "sonner";

// next-themes reports any string; Sonner only knows these three.
function toasterTheme(theme: string | undefined): ToasterProps["theme"] {
  return theme === "light" || theme === "dark" ? theme : "system";
}

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme } = useTheme();

  return (
    <Sonner
      theme={toasterTheme(theme)}
      className="toaster group"
      icons={{
        success: <CircleCheckIcon className="size-4" />,
        info: <InfoIcon className="size-4" />,
        warning: <TriangleAlertIcon className="size-4" />,
        error: <OctagonXIcon className="size-4" />,
        loading: <Loader2Icon className="size-4 animate-spin" />,
      }}
      style={{
        ["--normal-bg" as string]: "var(--popover)",
        ["--normal-text" as string]: "var(--popover-foreground)",
        ["--normal-border" as string]: "var(--border)",
        ["--border-radius" as string]: "var(--radius)",
      }}
      toastOptions={{
        classNames: {
          toast: "cn-toast",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
