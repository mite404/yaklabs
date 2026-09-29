import { useEffect, useRef } from "react";

/**
 * Drives the demo's own clock: one `requestAnimationFrame` loop for the life of the page,
 * reporting each frame's delta to `onTick`. Time never advances while the tab is hidden - the
 * gap is dropped, not queued, so focus returning never dumps a whole script's worth of narration
 * at once. `reduce`'s own guards (paused, idle, awaiting, complete, skipped) decide whether a
 * tick actually moves anything; this hook only ever reports real, visible time.
 */
export function useDemoClock(onTick: (dt: number) => void): void {
  const onTickRef = useRef(onTick);

  useEffect(() => {
    onTickRef.current = onTick;
  }, [onTick]);

  useEffect(() => {
    let frame = 0;
    let last = performance.now();

    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (document.visibilityState === "visible") onTickRef.current(dt);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame((now) => {
      last = now;
      frame = requestAnimationFrame(loop);
    });

    // Dropping the hidden gap rather than reporting it as one large `dt` keeps a backgrounded
    // tab from silently finishing several stages the moment it regains focus.
    const onVisible = () => {
      last = performance.now();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);
}
