import { useId, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { CatalogCard } from "./CatalogCard";
import { gradientBar } from "./GradientBar";
import {
  attachmentLabel,
  fillSentence,
  formatUsd,
  niceCeiling,
  resolveInteractive,
  summarize,
  type CardAttachment,
  type InteractiveSelection,
} from "./interactive";
import "./interactive.css";

// Bars ease between stops so the eye can follow where the money went.
const TRANSITION_MS = 300;

function prefersReducedMotion(): boolean {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

// One axis for every stop: rescaling per stop would make net look as tall as gross.
function sharedMax(selection: InteractiveSelection): number {
  return niceCeiling(
    Math.max(
      ...selection.props.control.stops.flatMap((stop) => stop.rows.map((row) => row.value)),
    ),
  );
}

/**
 * An interactive catalog card (ADR-029): a stepped slider switches the measure, and the
 * chart and the agent's sentence update instantly without calling the model. Each choice
 * is reported through `onChoose` so it can ride along with the next message (ADR-030).
 */
export function InteractiveCard({
  payload,
  turnId,
  onChoose,
}: {
  payload: unknown;
  turnId: string;
  onChoose: (attachment: CardAttachment) => void;
}) {
  const result = resolveInteractive(payload);
  const initial =
    result.kind === "approved"
      ? result.selection.props.control.stops.findIndex(
          (stop) => stop.id === result.selection.props.control.initial,
        )
      : 0;
  const [index, setIndex] = useState(initial);
  const [showRecipe, setShowRecipe] = useState(false);
  const barShape = gradientBar(useId());

  // An invalid payload gets the same honest catalog-limit card as any other rejection.
  if (result.kind === "rejected") return <CatalogCard payload={null} context="thread" />;

  const { props } = result.selection;
  const stops = props.control.stops;
  const stop = stops[index];
  const sentence = fillSentence(props.sentence, summarize(stop, props.period));
  const animate = !prefersReducedMotion();

  function choose(next: number) {
    setIndex(next);
    onChoose({
      turnId,
      label: attachmentLabel(stops[next], props.period),
      state: { measure: stops[next].label },
    });
  }

  return (
    <section className="card interactive-card" data-context="thread">
      <header className="card-heading">
        <div>
          <h2>{props.title}</h2>
        </div>
      </header>

      <p className="live-sentence" aria-live="polite">
        {sentence.map((part, i) =>
          part.live ? (
            <strong key={`${i}-${part.text}`} className="live-value">
              {part.text}
            </strong>
          ) : (
            <span key={i}>{part.text}</span>
          ),
        )}
      </p>

      <div className="chart">
        <ResponsiveContainer width="100%" height="100%" minWidth={0}>
          <BarChart
            data={stop.rows}
            margin={{ top: 12, right: 16, bottom: 4, left: 0 }}
            accessibilityLayer
          >
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
            />
            <YAxis
              domain={[0, sharedMax(result.selection)]}
              tickFormatter={formatUsd}
              tickLine={false}
              axisLine={false}
              width={52}
              tick={{ fill: "var(--muted)", fontSize: 12 }}
            />
            <Tooltip
              formatter={(value) => [formatUsd(Number(value)), stop.label]}
              cursor={{ fill: "var(--wash)" }}
            />
            <Bar
              dataKey="value"
              fill="var(--data)"
              shape={barShape}
              isAnimationActive={animate}
              animationDuration={TRANSITION_MS}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="stepped">
        <label htmlFor={`${turnId}-measure`}>{props.control.label}</label>
        <input
          id={`${turnId}-measure`}
          type="range"
          min={0}
          max={stops.length - 1}
          step={1}
          value={index}
          aria-valuetext={stop.label}
          style={{ ["--fill" as string]: `${(index / (stops.length - 1)) * 100}%` }}
          onChange={(event) => choose(Number(event.target.value))}
        />
        <div className="stops">
          {stops.map((item, i) => (
            <button
              key={item.id}
              aria-pressed={i === index}
              tabIndex={-1}
              data-edge={i === 0 ? "start" : i === stops.length - 1 ? "end" : undefined}
              style={{ left: `${(i / (stops.length - 1)) * 100}%` }}
              onClick={() => choose(i)}
            >
              {item.label}
            </button>
          ))}
        </div>
        <p className="stop-description">{stop.description}</p>
      </div>

      {showRecipe && (
        <ol className="recipe" aria-label="Recipe">
          {props.recipe.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      <footer>
        <span>{props.source}</span>
        <button className="btn btn-sm" aria-expanded={showRecipe} onClick={() => setShowRecipe(!showRecipe)}>
          {showRecipe ? "Hide recipe" : "Show recipe"}
        </button>
      </footer>
    </section>
  );
}
