/**
 * Shared utilities for Zustand store operations.
 */

/**
 * Prepends a new item to an array and trims to a maximum length.
 * Used by notification and activity log stores to maintain bounded lists.
 */
export function prependAndTrim<T>(items: T[], newItem: T, maxLength: number): T[] {
  const updated = [newItem, ...items];
  if (updated.length > maxLength) updated.length = maxLength;
  return updated;
}

/** Returns a Unix timestamp in milliseconds. */
export const nowMs = (): number => Date.now();

/** Returns the current time as an ISO 8601 string. */
export const nowISO = (): string => new Date().toISOString();
