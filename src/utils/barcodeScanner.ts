import type { WooCommerceProduct } from '../types';

/** Scanners type like a very fast keyboard: every character arrives within a few ms. */
export const SCAN_MAX_GAP_MS = 50;
export const SCAN_MIN_LENGTH = 4;

/** Meta keys plugins commonly use for barcodes/GTIN/EAN. */
const BARCODE_META_KEYS = new Set(['_barcode', 'barcode', '_gtin', 'gtin', '_ean', 'ean', '_upc']);

/** True when keystrokes land in a normal text field (the user is typing, not scanning). */
export function isTextEntryTarget(target: EventTarget | null): boolean {
  const el = target as HTMLElement | null;
  if (!el?.tagName) return false;
  if (el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return true;
  if (el.tagName !== 'INPUT') return false;
  const type = (el as HTMLInputElement).type;
  return !['checkbox', 'radio', 'button', 'submit', 'range'].includes(type);
}

/**
 * Stateful burst detector. Feed it keydowns; it returns the scanned code when an Enter
 * ends a run of >= minLength characters whose gaps never exceeded maxGapMs, else null.
 */
export function createBurstDetector(
  opts: { maxGapMs?: number; minLength?: number } = {}
): (key: string, time: number) => string | null {
  const maxGap = opts.maxGapMs ?? SCAN_MAX_GAP_MS;
  const minLength = opts.minLength ?? SCAN_MIN_LENGTH;
  let buffer = '';
  let last = 0;
  return (key, time) => {
    if (key === 'Enter') {
      const code = buffer;
      buffer = '';
      return code.length >= minLength ? code : null;
    }
    if (key.length !== 1) return null; // Shift/Tab etc. don't break a burst
    if (time - last > maxGap) buffer = '';
    last = time;
    buffer += key;
    return null;
  };
}

/** Match by SKU (case-insensitive), global unique id, or a known barcode meta key. */
export function findProductByCode(
  products: WooCommerceProduct[],
  code: string
): WooCommerceProduct | undefined {
  const c = code.trim().toLowerCase();
  if (!c) return undefined;
  return products.find(
    (p) =>
      p.sku?.toLowerCase() === c ||
      p.global_unique_id?.toLowerCase() === c ||
      p.meta_data?.some((m) => BARCODE_META_KEYS.has(m.key) && String(m.value).toLowerCase() === c)
  );
}

export interface CountRow {
  productId: number;
  system: number;
  counted: number;
}

/** Rows whose counted quantity differs from the system quantity. */
export const countDifferences = (rows: CountRow[]): Array<CountRow & { diff: number }> =>
  rows.map((r) => ({ ...r, diff: r.counted - r.system })).filter((r) => r.diff !== 0);
