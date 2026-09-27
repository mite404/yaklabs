import { Tooltip, TooltipContent, TooltipTrigger } from "@yaklabs/ui/components/tooltip";
import { FlaskConical, MessageSquareText } from "lucide-react";
import type { ComponentType } from "react";
import { Link, useLocation } from "react-router";
import type { ThemePreference } from "../theme";
import { ModeToggle } from "./mode-toggle";
import { SessionMenu } from "./session-menu";

const places: { to: string; label: string; Icon: ComponentType<{ className?: string }> }[] = [
  { to: "/", label: "Thread", Icon: MessageSquareText },
  { to: "/lab", label: "Lab", Icon: FlaskConical },
];

function Place({ to, label, Icon, active }: (typeof places)[number] & { active: boolean }) {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Link
            to={to}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            className={`flex size-10 items-center justify-center rounded-lg transition-colors ${
              active ? "bg-paper-deep text-ink" : "text-soft-ink hover:bg-paper-deep hover:text-ink"
            }`}
          />
        }
      >
        <Icon className="size-5" />
      </TooltipTrigger>
      <TooltipContent side="right">{label}</TooltipContent>
    </Tooltip>
  );
}

/** The app's rail: the mark, where you can go, and at the foot who you are and the light. */
export default function Rail({ onTheme }: { onTheme: (next: ThemePreference) => void }) {
  const { pathname } = useLocation();
  return (
    <nav
      aria-label="Main"
      className="flex h-full w-14 flex-col items-center gap-1 border-r border-hairline bg-paper py-3"
    >
      <Link
        to="/"
        aria-label="Kay"
        className="mb-4 flex size-10 items-center justify-center font-serif text-2xl text-ink"
      >
        K
      </Link>
      {places.map((place) => (
        <Place key={place.to} {...place} active={pathname === place.to} />
      ))}
      <div className="mt-auto flex flex-col items-center gap-2">
        <SessionMenu />
        <ModeToggle onChoose={onTheme} />
      </div>
    </nav>
  );
}
