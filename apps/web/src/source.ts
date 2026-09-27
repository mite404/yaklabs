import { scenarioNames, type LegacyCanvas, type ScenarioName, type Source } from "@yaklabs/runtime";
import { z } from "zod";
import type { AgentSource } from "./env";

/**
 * What the address asks the runtime to open (ADR-096): the device's own threads, a mock
 * scenario, or a scenario name that does not exist, which opens nothing.
 */
export type Wanted =
  | { kind: "device" }
  | { kind: "scenario"; name: ScenarioName }
  | { kind: "unknown"; name: string };

/** The title bar's word on where the threads live and who answers, and the longer why. */
export type Marker = { label: string; hint: string };

const PARAM = "scenario";

const idsSchema = z.array(z.string());

// A stored list of ids, or none when the key is missing, not JSON, or not a list of strings.
function idsFrom(raw: string | null): string[] {
  if (raw === null) return [];
  try {
    const parsed = idsSchema.safeParse(JSON.parse(raw)); // → string[], or why it is not
    return parsed.success ? parsed.data : [];
  } catch {
    return [];
  }
}

/** Reads `?scenario=` from the page's address, the one place the page decides it. */
export function wantedFrom(search: string): Wanted {
  const name = new URLSearchParams(search).get(PARAM); // → string | null
  if (name === null) return { kind: "device" };
  const known = scenarioNames.find((each) => each === name);
  return known === undefined ? { kind: "unknown", name } : { kind: "scenario", name: known };
}

/**
 * `path` with the scenario the page was opened on, even an unknown one, so a link inside a mock
 * visit never drifts onto the device's data.
 */
export function keepScenario(path: string, wanted: Wanted): string {
  if (wanted.kind === "device") return path;
  return `${path}?${new URLSearchParams({ [PARAM]: wanted.name }).toString()}`;
}

/**
 * The part of a query that decides what the page opens: `?scenario=<name>`, or nothing for the
 * device. Two addresses with the same scenario give the same string, whatever else they carry.
 */
export function scenarioQuery(search: string): string {
  return keepScenario("", wantedFrom(search));
}

/** Why an unknown scenario opens nothing, naming the ones that exist. */
export function unknownScenario(name: string): string {
  return `There is no scenario called "${name}". The scenarios are ${scenarioNames.join(", ")}.`;
}

/**
 * What the title bar says about the data on screen (ADR-096): a mock and its name, kept on this
 * device, or not kept at all, and whether a live model answers. Null until the source is known.
 */
export function markerFor(source: Source | null, agent: AgentSource): Marker | null {
  if (source === null) return null;
  if (source.kind === "scenario") {
    return {
      label: `Mock: ${source.name}`,
      hint: "Sample data, answered by the lab's script. Nothing here is saved.",
    };
  }
  const live = agent.kind === "gateway";
  const who = live ? "Replies come from a live model." : "Replies come from the lab's script.";
  const kept =
    source.storage === "opfs"
      ? { label: "On this device", hint: "Threads are kept in this browser's own storage." }
      : {
          label: "Not saved",
          hint: "This browser cannot keep threads; they go when the tab closes.",
        };
  return { label: live ? `${kept.label} · Live model` : kept.label, hint: `${kept.hint} ${who}` };
}

/**
 * The v1 canvas's hidden lanes and lane order (ADR-089) from their two localStorage values,
 * for the worker's 1 → 2 migration; undefined when neither was ever written.
 */
export function legacyFrom(hidden: string | null, order: string | null): LegacyCanvas | undefined {
  if (hidden === null && order === null) return undefined;
  return { hidden: idsFrom(hidden), order: idsFrom(order) };
}
