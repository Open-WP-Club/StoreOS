import type { ApiResponse, BatchOperationResponse } from '../types';

/** Number of failed ApiResponses (the service layer never throws; it returns success: false). */
export function countFailed(results: ApiResponse<unknown>[]): number {
  return results.filter((r) => !r.success).length;
}

/** Ids of entries in a WC batch response that carry an `error` object instead of data. */
export function batchErrorIds(
  data: BatchOperationResponse<unknown> | undefined,
  op: 'create' | 'update' | 'delete'
): number[] {
  return ((data?.[op] ?? []) as Array<{ id?: number; error?: unknown } | null>)
    .filter((e) => e && e.error)
    .map((e) => e?.id as number);
}
