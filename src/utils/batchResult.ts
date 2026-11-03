import type { BatchOperationResponse } from '../types';

/** Ids of entries in a WC batch response that carry an `error` object instead of data. */
export function batchErrorIds(
  data: BatchOperationResponse<unknown> | undefined,
  op: 'create' | 'update' | 'delete'
): number[] {
  return ((data?.[op] ?? []) as Array<{ id?: number; error?: unknown } | null>)
    .filter((e) => e && e.error)
    .map((e) => e?.id as number);
}
