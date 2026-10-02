import { useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { BAR_RADIUS } from "./CatalogCard";
import { formatUsd, type fillSentence, type Stop } from "./interactive";

// The interactive card's parts (InteractiveCard.tsx): its sentence, chart, slider and steps.

/** How long the bars ease between stops, so the eye can follow where the money went. */
export const TRANSITION_MS = 300;

// The agent's sentence with the shown stop's figures in it, read out as they change.
export function LiveSentence({ parts }: { parts: ReturnType<typeof fillSentence> }) {
  return (
    <p className="live-sentence" aria-live="polite">
      {parts.map((part, i) =>
        part.live ? (
          <strong key={`${i}-${part.text}`} className="live-value">
            {part.text}
          </strong>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </p>
  );
}

// The shown stop's bars on the axis every stop shares, easing only while `animate` says so.
export function StopChart({ stop, max, animate }: { stop: Stop; max: number; animate: boolean }) {
  return (
    <div className="chart">
      <ResponsiveContainer width="100%" height="100%" minWidth={0}>
        <BarChart
          data={stop.rows}
          margin={{ top: 12, right: 16, bottom: 4, left: 0 }}
          accessibilityLayer
        >
          <CartesianGrid vertical={false} stroke="var(--hairline)" />
          <XAxis
            dataKey="label"
            tickLine={false}
            axisLine={false}
            tick={{ fill: "var(--soft-ink)", fontSize: 12 }}
          />
          <YAxis
            domain={[0, max]}
            tickFormatter={formatUsd}
            tickLine={false}
            axisLine={false}
            width={52}
            tick={{ fill: "var(--soft-ink)", fontSize: 12 }}
          />
          <Tooltip
            formatter={(value) => [formatUsd(Number(value)), stop.label]}
            cursor={{ fill: "var(--paper-deep)" }}
          />
          <Bar
            dataKey="value"
            fill="var(--data)"
            radius={[BAR_RADIUS, BAR_RADIUS, 0, 0]}
            isAnimationActive={animate}
            animationDuration={TRANSITION_MS}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// Where a stop's button sits along the track: "start" and "end" at the ends, else nothing.
const edgeOf = (i: number, count: number): "start" | "end" | undefined => {
  if (i === 0) return "start";
  return i === count - 1 ? "end" : undefined;
};

// The stepped slider, a button for each stop under it, and the shown stop's description.
export function StepSlider({
  id,
  label,
  stops,
  index,
  onChoose,
}: {
  id: string;
  label: string;
  stops: Stop[];
  index: number;
  onChoose: (next: number) => void;
}) {
  const at = (i: number) => `${(i / (stops.length - 1)) * 100}%`; // → a stop's place on the track
  return (
    <div className="stepped">
      <label htmlFor={id}>{label}</label>
      <input
        id={id}
        type="range"
        min={0}
        max={stops.length - 1}
        step={1}
        value={index}
        aria-valuetext={stops[index].label}
        style={{ ["--fill" as string]: at(index) }}
        onChange={(event) => {
          onChoose(Number(event.target.value));
        }}
      />
      <div className="stops">
        {stops.map((item, i) => (
          <button
            key={item.id}
            aria-pressed={i === index}
            tabIndex={-1}
            data-edge={edgeOf(i, stops.length)}
            style={{ left: at(i) }}
            onClick={() => {
              onChoose(i);
            }}
          >
            {item.label}
          </button>
        ))}
      </div>
      <p className="stop-description">{stops[index].description}</p>
    </div>
  );
}

// The steps behind the answer, shut at first (ADR-036): the answer earns trust on its own, the
// steps are there on demand. The source sits beside the toggle.
export function ShowWork({ steps, source }: { steps: string[]; source: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      {open && (
        <ol className="work-steps" aria-label="How I got this">
          {steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}
      <footer>
        <span>{source}</span>
        <button
          className="btn btn-sm card-toggle"
          aria-expanded={open}
          onClick={() => {
            setOpen(!open);
          }}
        >
          {open ? "Hide my work" : "Show my work"}
        </button>
      </footer>
    </>
  );
}
