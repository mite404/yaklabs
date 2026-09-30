import type { Beat, Script } from "./script";
import { background } from "./scenarios/background";
import { brief } from "./scenarios/brief";
import { interrupted } from "./scenarios/interrupted";

/** The scenarios the demo plays, in the order the picker lists them. */
export const scripts: Script[] = [brief, interrupted, background];

/** A script by its id, or the first when the id is unknown. */
export function scriptFor(id?: string | null): Script {
  return scripts.find((script) => script.id === id) ?? scripts[0];
}

/** Every beat of a script that the user performs, in order: for a test that the player performs them all. */
export function userBeats(script: Script): Beat[] {
  return script.beats.filter((beat) => beat.kind !== "reply");
}
