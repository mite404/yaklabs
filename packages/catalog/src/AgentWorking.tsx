import type { CSSProperties } from "react";
import "./motion.css";

// React's style type has no custom properties; this widens it to the `--name` ones.
type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;

type AgentWorkingProps = {
  /** One full wave, in milliseconds. */
  duration?: number;
  /** Freeze the wave at this point of the cycle (0-1); for reviewing frames, not for the app. */
  phase?: number;
  /** What a screen reader announces. */
  label?: string;
};

/**
 * Kay's 2x2 task-size glyph as an "agent working" indicator: a wave of green that fades
 * in and out left to right on a loop. Holds still under reduced motion.
 */
export function AgentWorking({
  duration = 150,
  phase,
  label = "Agent working",
}: AgentWorkingProps) {
  const frozen = phase !== undefined;
  const style: StyleWithVars = {
    "--working-duration": `${duration}ms`, // number → "150ms"
    ...(frozen && { "--working-phase": phase }), // 0-1, read by the paused delay in motion.css
  };
  // <output> is a live status region, so the label is announced once when it appears.
  return (
    <output
      className="agent-working"
      aria-label={label}
      data-frozen={frozen || undefined}
      style={style}
    >
      <span className="agent-working-cell" />
      <span className="agent-working-cell" />
      <span className="agent-working-cell" />
      <span className="agent-working-cell" />
    </output>
  );
}
