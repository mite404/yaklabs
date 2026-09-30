/**
 * Marks a switch as exhaustive: adding a case to the union fails the build here.
 * @throws {Error} Only if a value outside the type arrives at runtime.
 */
export function assertNever(value: never): never {
  throw new Error(`Unexpected value: ${JSON.stringify(value)}`);
}
