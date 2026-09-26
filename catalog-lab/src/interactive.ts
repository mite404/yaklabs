import { z } from "zod";

const text = z.string().trim().min(1).max(120);
const rows = z
  .array(
    z.strictObject({
      label: z.string().min(1).max(40),
      value: z.number().finite().min(-1e12).max(1e12),
    }),
  )
  .min(1)
  .max(100);

// The only values a live sentence may show; the runtime computes every one of them.
const PLACEHOLDERS = ["measure", "total", "peakLabel", "peakValue", "period"] as const;
type Placeholder = (typeof PLACEHOLDERS)[number];
const PLACEHOLDER_PATTERN = /\{(\w+)\}/g;

function isPlaceholder(name: string): name is Placeholder {
  return PLACEHOLDERS.some((known) => known === name);
}

function usesOnlyKnownPlaceholders(template: string): boolean {
  return [...template.matchAll(PLACEHOLDER_PATTERN)].every(([, name]) => isPlaceholder(name));
}

/**
 * An interactive catalog card (ADR-029): one chart whose measure the user steps through.
 * The agent supplies every stop's data and a sentence template up front; the runtime
 * switches between them, so no model call happens while the user explores.
 */
export const interactiveSchema = z
  .strictObject({
    catalogVersion: z.literal("1"),
    component: z.literal("BarChart"),
    props: z.strictObject({
      title: text,
      source: text,
      period: z.string().trim().min(1).max(40),
      unit: z.literal("USD"),
      variant: z.literal("measure-steps"),
      control: z.strictObject({
        label: text,
        initial: z.string().min(1).max(40),
        stops: z
          .array(
            z.strictObject({
              id: z.string().regex(/^[a-z][a-z-]{0,39}$/),
              label: z.string().trim().min(1).max(40),
              description: text,
              rows,
            }),
          )
          .min(2)
          .max(6),
      }),
      sentence: z
        .string()
        .trim()
        .min(1)
        .max(160)
        .refine(usesOnlyKnownPlaceholders, "Sentence uses an unknown placeholder"),
      steps: z.array(text).min(1).max(8),
    }),
  })
  .superRefine(({ props }, context) => {
    const { stops, initial } = props.control;
    const labels = stops[0].rows.map((row) => row.label).join("|");
    if (!stops.some((stop) => stop.id === initial))
      context.addIssue({ code: "custom", message: "Initial stop does not exist" });
    if (new Set(stops.map((stop) => stop.id)).size !== stops.length)
      context.addIssue({ code: "custom", message: "Stop ids must be unique" });
    if (stops.some((stop) => stop.rows.map((row) => row.label).join("|") !== labels))
      context.addIssue({ code: "custom", message: "Every stop must cover the same rows" });
  });

/** A validated interactive card selection. */
export type InteractiveSelection = z.infer<typeof interactiveSchema>;
/** One position on the stepped control, with its own data. */
export type Stop = InteractiveSelection["props"]["control"]["stops"][number];

/** A card choice that rides along with the user's next message (ADR-030, ADR-031). */
export type CardAttachment = {
  turnId: string;
  label: string;
  state: { measure: string };
};

/** Validates untrusted agent output; anything invented rejects the whole card (ADR-024). */
export function resolveInteractive(
  input: unknown,
): { kind: "approved"; selection: InteractiveSelection } | { kind: "rejected" } {
  const parsed = interactiveSchema.safeParse(input);
  return parsed.success ? { kind: "approved", selection: parsed.data } : { kind: "rejected" };
}

// Axis maxima snap to these multiples of a power of ten, so ticks land on round numbers.
const NICE_STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10];

// One decimal where it carries information, none where it would read "9.0".
function compact(value: number): string {
  return value.toFixed(1).replace(/\.0$/, "");
}

/** Formats dollars compactly for sentences and axes, e.g. "$57.2k", "$9k", or "$950". */
export function formatUsd(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `${sign}$${compact(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}$${compact(abs / 1_000)}k`;
  return `${sign}$${Math.round(abs)}`;
}

/** Rounds an axis maximum up to a round number, e.g. 11,200 becomes 12,000. */
export function niceCeiling(value: number): number {
  if (value <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(value));
  const step = NICE_STEPS.find((candidate) => candidate * magnitude >= value) ?? 10;
  return step * magnitude;
}

/** The values a live sentence can show for one stop; the first row wins a tied peak. */
export function summarize(stop: Stop, period: string): Record<Placeholder, string> {
  const total = stop.rows.reduce((sum, row) => sum + row.value, 0);
  const peak = stop.rows.reduce((best, row) => (row.value > best.value ? row : best));
  return {
    measure: stop.label,
    total: formatUsd(total),
    peakLabel: peak.label,
    peakValue: formatUsd(peak.value),
    period,
  };
}

/**
 * Splits a sentence template into text and filled values, so the card can emphasise
 * the live numbers. Unknown placeholders never reach here (the schema rejects them); one
 * that did would stay as its literal text.
 */
export function fillSentence(
  template: string,
  values: Record<Placeholder, string>,
): { text: string; live: boolean }[] {
  const parts: { text: string; live: boolean }[] = [];
  let cursor = 0;
  for (const match of template.matchAll(PLACEHOLDER_PATTERN)) {
    if (match.index > cursor)
      parts.push({ text: template.slice(cursor, match.index), live: false });
    const name = match[1];
    parts.push(
      isPlaceholder(name) ? { text: values[name], live: true } : { text: match[0], live: false },
    );
    cursor = match.index + match[0].length;
  }
  if (cursor < template.length) parts.push({ text: template.slice(cursor), live: false });
  return parts;
}

/** The chip label for a card choice, e.g. "Net profit · Sep 14–20". */
export function attachmentLabel(stop: Stop, period: string): string {
  return `${stop.label} · ${period}`;
}
