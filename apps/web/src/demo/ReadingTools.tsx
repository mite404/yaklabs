import { Button } from "@yaklabs/ui/components/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@yaklabs/ui/components/dropdown-menu";
import { Input } from "@yaklabs/ui/components/input";
import { Bookmark, ChevronDown, ChevronUp, Ellipsis, Search, X } from "lucide-react";
import { useEffect, useRef, useState, type KeyboardEvent, type RefObject } from "react";

type Request = { id: string; text: string; time: string };

type ReadingToolsProps = {
  scroller: RefObject<HTMLDivElement | null>;
  requests: Request[];
  onSearchChange?: (query: string) => void;
};

function turnIn(scroller: HTMLDivElement, id: string): HTMLElement | undefined {
  return Array.from(scroller.querySelectorAll<HTMLElement>("[data-turn-id]")).find(
    (turn) => turn.dataset.turnId === id,
  );
}

function centerTurn(scroller: HTMLDivElement, turn: HTMLElement): void {
  const style = getComputedStyle(scroller);
  const insetTop = parseFloat(style.paddingTop) || 0;
  const insetBottom = parseFloat(style.paddingBottom) || 0;
  const band = scroller.clientHeight - insetTop - insetBottom;
  const scrollerTop = scroller.getBoundingClientRect().top + scroller.clientTop;
  const rect = turn.getBoundingClientRect();
  const top = rect.top - scrollerTop + scroller.scrollTop;
  const target = rect.height <= band ? top - insetTop - (band - rect.height) / 2 : top - insetTop;
  const max = scroller.scrollHeight - scroller.clientHeight;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  scroller.scrollTo({
    top: Math.round(Math.min(Math.max(target, 0), Math.max(max, 0))),
    behavior: reduced ? "instant" : "smooth",
  });
}

function flashTurn(turn: HTMLElement, clear: () => void): ReturnType<typeof setTimeout> {
  turn.dataset.flash = "true";
  return setTimeout(() => {
    delete turn.dataset.flash;
    clear();
  }, 1200);
}

/** Demo-only reading controls for the scripted thread. Nothing is sent to a service. */
export function ReadingTools({ scroller, requests, onSearchChange }: ReadingToolsProps) {
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(-1);
  const searchTrigger = useRef<HTMLButtonElement>(null);
  const searchInput = useRef<HTMLInputElement>(null);
  const flashTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const flashedTurn = useRef<HTMLElement | null>(null);
  const turns = scroller.current?.querySelectorAll<HTMLElement>("[data-turn-id]");
  const matches = query
    ? Array.from(turns ?? []).filter((turn) =>
        turn.textContent.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
      )
    : [];

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  useEffect(() => {
    return () => {
      if (flashTimer.current) clearTimeout(flashTimer.current);
      if (flashedTurn.current) delete flashedTurn.current.dataset.flash;
    };
  }, []);

  function jump(id: string) {
    const container = scroller.current;
    const turn = container && turnIn(container, id);
    if (!container || !turn) return;
    centerTurn(container, turn);
    if (flashTimer.current) clearTimeout(flashTimer.current);
    if (flashedTurn.current) delete flashedTurn.current.dataset.flash;
    flashedTurn.current = turn;
    flashTimer.current = flashTurn(turn, () => {
      flashedTurn.current = null;
      flashTimer.current = null;
    });
  }

  function navigate(direction: number) {
    if (matches.length === 0) return;
    const next =
      active === -1 && direction < 0
        ? matches.length - 1
        : (active + direction + matches.length) % matches.length;
    setActive(next);
    const id = matches[next]?.dataset.turnId;
    if (id !== undefined) jump(id);
  }

  function closeSearch() {
    setSearchOpen(false);
    setQuery("");
    setActive(-1);
    onSearchChange?.("");
    searchTrigger.current?.focus();
  }

  function onSearchKeyDown(event: KeyboardEvent) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    event.stopPropagation();
    closeSearch();
  }

  return (
    <div className="flex items-center gap-1">
      <DropdownMenu>
        <DropdownMenuTrigger
          ref={searchTrigger}
          render={<Button variant="ghost" size="icon-sm" aria-label="Thread options" />}
        >
          <Ellipsis aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            onClick={() => {
              setSearchOpen(true);
            }}
          >
            <Search aria-hidden="true" /> Search this thread
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <DropdownMenu>
        <DropdownMenuTrigger
          onPointerDownCapture={(event) => {
            if (event.altKey) {
              event.preventDefault();
              event.stopPropagation();
            }
          }}
          onClick={(event) => {
            if (!event.altKey) return;
            event.preventDefault();
            event.stopPropagation();
            const latest = requests.at(-1);
            if (latest) jump(latest.id);
          }}
          render={<Button variant="ghost" size="icon-sm" aria-label="Request bookmarks" />}
        >
          <Bookmark aria-hidden="true" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {requests.length === 0 ? (
            <DropdownMenuItem disabled>No requests yet</DropdownMenuItem>
          ) : (
            requests.map((request) => (
              <DropdownMenuItem
                key={request.id}
                aria-label={`${request.text}, ${request.time}`}
                onClick={() => {
                  jump(request.id);
                }}
              >
                <span aria-hidden="true">{Array.from(request.text).slice(0, 15).join("")}</span>
                <span aria-hidden="true" className="ml-auto text-muted-foreground">
                  {request.time}
                </span>
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {searchOpen && (
        <search className="flex items-center gap-1">
          <Input
            ref={searchInput}
            aria-label="Search this thread"
            placeholder="Search this thread"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActive(-1);
              onSearchChange?.(event.target.value);
            }}
            onKeyDown={(event) => {
              onSearchKeyDown(event);
              if (event.key === "Enter") {
                event.preventDefault();
                navigate(event.shiftKey ? -1 : 1);
              }
            }}
          />
          <output className="whitespace-nowrap text-xs text-muted-foreground">
            {Math.min(active + 1, matches.length)} of {matches.length}
          </output>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Previous match"
            disabled={matches.length === 0}
            onKeyDown={onSearchKeyDown}
            onClick={() => {
              navigate(-1);
            }}
          >
            <ChevronUp aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Next match"
            disabled={matches.length === 0}
            onKeyDown={onSearchKeyDown}
            onClick={() => {
              navigate(1);
            }}
          >
            <ChevronDown aria-hidden="true" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Close search"
            onKeyDown={onSearchKeyDown}
            onClick={closeSearch}
          >
            <X aria-hidden="true" />
          </Button>
        </search>
      )}
    </div>
  );
}
