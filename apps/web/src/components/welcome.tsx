import { useAuth } from "@workos-inc/authkit-react";
import type { ThreadSummary } from "@yaklabs/runtime";
import { sidebarTree } from "@yaklabs/runtime";
import { Button } from "@yaklabs/ui/components/button";
import { FileText, Folder, Globe, Plus, Terminal } from "lucide-react";
import { env } from "../env";
import { useShell } from "../shell/model";
import { KayMark } from "../shell/sidebar";
import type { PaneKind } from "../shell/state";
import { WelcomeArt } from "./splash";
import { SplashSwitch } from "./splash-switch";

// The part of the day the greeting names: the morning in the light theme, the evening in the
// dark one (Ethan), rather than the clock. Both are in the DOM; index.css shows the theme's.
type Part = "morning" | "evening";
const PARTS: readonly Part[] = ["morning", "evening"];

const DATE = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric" });
const NOT_HERE = "Not in the web build yet";

// "Good morning, Ethan", or "Good morning" for a build with no sign-in.
const greetingFor = (part: Part, name: string | null): string =>
  `Good ${part}${name === null ? "" : `, ${name}`}`;

const lineFor = (part: Part): string => `Spend your ${part} on the thing that matters.`;

// Kay's own corners for the greeting's actions, the app's 8px and not the site's 4px button:
// one step up from --radius, so it follows the token.
const ACTION = "h-8 rounded-xl px-3";

const LABEL = "text-[11px] font-medium tracking-[0.1em] text-soft-ink uppercase";

// The site's 4px button corners (design pillars rule 8) through shadcn's --radius, as the
// shell's other icon buttons have them: the vendored base-lyra button is square by default.
const SITE_CORNERS = "rounded-[var(--radius)]";

function Greeting({ name }: { name: string | null }) {
  return (
    <div>
      <p className="text-xs font-medium tracking-[0.08em] text-soft-ink uppercase">
        {DATE.format(new Date())}
      </p>
      {PARTS.map((part) => (
        <div key={part} data-part={part}>
          <h1 className="mt-1 font-sans text-2xl font-semibold tracking-tight text-ink">
            {greetingFor(part, name)}
          </h1>
          <p className="mt-1 text-soft-ink">{lineFor(part)}</p>
        </div>
      ))}
    </div>
  );
}

// Signed in with WorkOS (ADR-084): the greeting carries the first name.
function WorkOsGreeting() {
  const { user } = useAuth();
  return <Greeting name={user?.firstName ?? null} />;
}

function LocalGreeting() {
  return <Greeting name={null} />;
}

const GreetingLine = env.auth.kind === "workos" ? WorkOsGreeting : LocalGreeting;

function Projects() {
  const shell = useShell();
  const projects = shell === null ? [] : sidebarTree(shell.workspace).map((node) => node.project);
  return (
    <section aria-labelledby="welcome-projects" className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <h2 id="welcome-projects" className={LABEL}>
          Projects
        </h2>
        <Button
          variant="ghost"
          size="icon-xs"
          className={SITE_CORNERS}
          aria-label="New project"
          onClick={() => shell?.newProject()}
        >
          <Plus />
        </Button>
      </div>
      {projects.length > 0 && (
        <ul className="flex flex-col">
          {projects.map((project) => (
            <li key={project.id} className="flex items-center gap-2 py-1.5 text-sm text-ink">
              <Folder className="size-4 text-soft-ink" aria-hidden="true" />
              {project.name}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Actions({ thread }: { thread: ThreadSummary }) {
  const shell = useShell();
  return (
    <section aria-labelledby="welcome-actions" className="flex flex-col gap-2">
      <h2 id="welcome-actions" className={LABEL}>
        More actions
      </h2>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" className={ACTION} disabled title={NOT_HERE}>
          <FileText />
          Open file
        </Button>
        <Button
          variant="outline"
          size="sm"
          className={ACTION}
          onClick={() => shell?.setPane(thread.id, "browser")}
        >
          <Globe />
          Open browser
        </Button>
        <Button variant="outline" size="sm" className={ACTION} disabled title={NOT_HERE}>
          <Terminal />
          Open terminal
        </Button>
      </div>
    </section>
  );
}

/**
 * A new thread's welcome (ADR-136), after Kay's own new tab: the mark, the date, a greeting for
 * the theme's time of day, the projects, and the actions a thread can open with. It shows in the main
 * pane while the thread has no turns, over the painting `<html data-splash>` names, and leaves
 * with the first turn. Open file and Open terminal are the desktop app's; here they wait.
 * @param pane The layout the thread is in. The debug switch for the painting shows only in the
 * Thread layout, where the welcome has the window to itself, and never beside the canvas or the
 * browser.
 */
export function Welcome({ thread, pane }: { thread: ThreadSummary; pane: PaneKind }) {
  return (
    <div className="welcome" data-slot="welcome">
      <WelcomeArt />
      <div className="welcome-words flex w-full max-w-sm flex-col gap-7">
        <div className="flex flex-col gap-4">
          <span className="grid size-10 place-items-center rounded-full bg-paper-deep text-ink">
            <KayMark className="size-5" />
          </span>
          <GreetingLine />
        </div>
        <Projects />
        <Actions thread={thread} />
      </div>
      {pane === "thread" && <SplashSwitch className={`${ACTION} absolute top-4 right-4 z-10`} />}
    </div>
  );
}
