export const META_COST = '_storeos_cost';

/** Cost price from product meta_data, or null when unset/invalid. */
export function getCost(product: {
  meta_data?: Array<{ key: string; value: unknown }>;
}): number | null {
  const v = product.meta_data?.find((m) => m.key === META_COST)?.value;
  if (v === undefined || v === null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** meta_data entry for a product update; null/empty clears the cost. */
export function costMeta(value: string | number | null): { key: string; value: string } {
  return { key: META_COST, value: value === null ? '' : String(value).trim() };
}
