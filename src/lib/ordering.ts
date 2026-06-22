import { generateKeyBetween } from "fractional-indexing";

// Fractional indexing: a `position` is a string key. To place an item between two
// others, generate a key between their keys — one row update, no renumbering.

/** A key that sorts strictly between `a` and `b` (either null = the open end). */
export function positionBetween(a: string | null, b: string | null): string {
  return generateKeyBetween(a, b);
}

/** `count` ascending keys after `after` (null = from the start). For seeding. */
export function positionsAfter(after: string | null, count: number): string[] {
  const keys: string[] = [];
  let prev = after;
  for (let i = 0; i < count; i++) {
    prev = generateKeyBetween(prev, null);
    keys.push(prev);
  }
  return keys;
}

/**
 * Position for dropping an item at `targetIndex` within an already-ordered list
 * of sibling positions (the moving item excluded from `siblings`).
 */
export function positionForIndex(siblings: string[], targetIndex: number): string {
  const before = siblings[targetIndex - 1] ?? null;
  const after = siblings[targetIndex] ?? null;
  return generateKeyBetween(before, after);
}
