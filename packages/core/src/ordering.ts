/**
 * Fractional indexing for ordered lists (rows, columns, cards).
 *
 * Compute a new `position` between two neighbors without renumbering.
 * After ~50 inserts between the same neighbors, precision degrades —
 * `needsRebalance()` flags when a rebalance job should run.
 */

const REBALANCE_GAP_THRESHOLD = 1e-9;

export function positionBetween(before?: number | null, after?: number | null): number {
  if (before == null && after == null) return 0;
  if (before == null) return (after as number) - 1;
  if (after == null) return before + 1;
  return (before + after) / 2;
}

export function positionForAppend(items: ReadonlyArray<{ position: number }>): number {
  if (items.length === 0) return 0;
  const last = items[items.length - 1];
  return last!.position + 1;
}

export function positionForPrepend(items: ReadonlyArray<{ position: number }>): number {
  if (items.length === 0) return 0;
  const first = items[0];
  return first!.position - 1;
}

export function needsRebalance(items: ReadonlyArray<{ position: number }>): boolean {
  for (let i = 1; i < items.length; i++) {
    const a = items[i - 1]!.position;
    const b = items[i]!.position;
    if (Math.abs(b - a) < REBALANCE_GAP_THRESHOLD) return true;
  }
  return false;
}

export function rebalance<T extends { position: number }>(items: ReadonlyArray<T>): T[] {
  return items
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((item, i) => ({ ...item, position: i }));
}

export function sortByPosition<T extends { position: number }>(items: ReadonlyArray<T>): T[] {
  return items.slice().sort((a, b) => a.position - b.position);
}
