import { useState } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';

/** Pages at or below this many rows render normally (no scroll container, no spacers). */
export const VIRTUALIZE_THRESHOLD = 60;

/**
 * Windowing for <table> bodies. Renders only the rows near the viewport inside a scroll
 * container and replaces the rest with two spacer rows. Selection/select-all logic is
 * unaffected because it works on the data array, not the DOM.
 * ponytail: fixed row-height estimate (no per-row measurement); add measureElement if rows vary a lot.
 */
export function useVirtualRows<T>(items: readonly T[], estimateSize = 56) {
  // Callback ref (state) rather than useRef so the returned object is safe to read during render.
  const [scrollEl, scrollContainer] = useState<HTMLDivElement | null>(null);
  const enabled = items.length > VIRTUALIZE_THRESHOLD;
  // eslint-disable-next-line react-hooks/incompatible-library -- tanstack/virtual returns non-memoizable functions
  const virtualizer = useVirtualizer({
    count: enabled ? items.length : 0,
    getScrollElement: () => scrollEl,
    estimateSize: () => estimateSize,
    overscan: 10,
  });

  if (!enabled) {
    return { scrollContainer, enabled, rows: items, padTop: 0, padBottom: 0 };
  }
  const virtualItems = virtualizer.getVirtualItems();
  const first = virtualItems[0];
  const last = virtualItems[virtualItems.length - 1];
  return {
    scrollContainer,
    enabled,
    rows: virtualItems.map((v) => items[v.index] as T),
    padTop: first ? first.start : 0,
    padBottom: last ? virtualizer.getTotalSize() - last.end : 0,
  };
}
