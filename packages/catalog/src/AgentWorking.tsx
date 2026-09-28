import type { CSSProperties } from "react";
import "./motion.css";

// React's style type has no custom properties; this widens it to the `--name` ones.
type StyleWithVars = CSSProperties & Record<`--${string}`, string | number>;

type AgentWorkingProps = {
  /** One full wave, in milliseconds. */
  duration?: number;
  /** What a screen reader announces. */
  label?: string;
};

/**
 * Kay's 2x2 task-size glyph as an "agent working" indicator: a wave of green that fades
 * in and out left to right on a loop. Holds still under reduced motion.
 */
export function AgentWorking({ duration = 1200, label = "Agent working" }: AgentWorkingProps) {
  const style: StyleWithVars = { "--working-duration": `${duration}ms` }; // number → "1200ms"
  // <output> is a live status region, so the label is announced once when it appears.
  return (
    <output className="agent-working" aria-label={label} style={style}>
      <span className="agent-working-cell" />
      <span className="agent-working-cell" />
      <span className="agent-working-cell" />
      <span className="agent-working-cell" />
    </output>
  );
}
