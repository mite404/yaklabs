import { NavLink } from "react-router";
import type { ThemePreference } from "../theme";
import { ModeToggle } from "./mode-toggle";
import { SessionMenu } from "./session-menu";

const links = [
  { to: "/", label: "Thread" },
  { to: "/lab", label: "Lab" },
] as const;

/** The app's one line of chrome: where you are, who you are, and light or dark. */
export default function Header({ onTheme }: { onTheme: (next: ThemePreference) => void }) {
  return (
    <header className="flex items-center justify-between border-b border-hairline px-4 py-2">
      <nav className="flex items-center gap-4" aria-label="Main">
        <span className="font-serif text-lg text-ink">Kay</span>
        {links.map(({ to, label }) => (
          <NavLink
            key={to}
            to={to}
            end
            className={({ isActive }) =>
              isActive ? "text-sm font-medium text-ink" : "text-sm text-soft-ink"
            }
          >
            {label}
          </NavLink>
        ))}
      </nav>
      <div className="flex items-center gap-3">
        <SessionMenu />
        <ModeToggle onChoose={onTheme} />
      </div>
    </header>
  );
}
