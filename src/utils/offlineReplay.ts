import { replayPosSale, type PosSaleOpData } from './posOfflineSale';
import { batchErrorIds } from './batchResult';
import type { ApiResponse, BatchOperationResponse, PendingOperation } from '../types';
import type WooCommerceService from '../services/woocommerce';

type Result = { success: boolean; error?: string };

// Deleting something that is already gone is a success on replay (idempotent delete).
const GONE = /invalid[_ ]id|not found|no .* found|404/i;

type BatchOps = {
  create?: Record<string, unknown>[];
  update?: Record<string, unknown>[];
  delete?: number[];
};

/** Run a WC batch; item-level errors fail the op (the whole batch is safe to re-run), except already-gone deletes. */
async function runBatch(
  call: (ops: BatchOps) => Promise<ApiResponse<BatchOperationResponse<unknown>>>,
  ops: BatchOps
): Promise<Result> {
  const res = await call(ops);
  if (!res.success) return res;
  const deleteFailed = (
    (res.data?.delete ?? []) as Array<{
      error?: { code?: string; message?: string };
    } | null>
  ).filter((e) => e?.error && !GONE.test(`${e.error.code ?? ''} ${e.error.message ?? ''}`));
  const failed =
    batchErrorIds(res.data, 'create').length +
    batchErrorIds(res.data, 'update').length +
    deleteFailed.length;
  return failed > 0
    ? { success: false, error: `${failed} batch item(s) failed` }
    : { success: true };
}

const okIfGone = (r: Result): Result =>
  !r.success && GONE.test(r.error ?? '') ? { success: true } : r;

/**
 * Replay one queued operation. `service` must belong to `operation.storeId`.
 * Refunds are deliberately NOT queueable: a replay after a lost response would refund twice.
 * Create types are only queued with a client-id guard (POS sale) or a unique SKU (CSV import).
 */
export async function replayOperation(
  service: WooCommerceService,
  operation: PendingOperation
): Promise<Result> {
  const d = operation.data;
  switch (operation.type) {
    case 'create_order':
      return typeof d.clientId === 'string'
        ? replayPosSale(service, d as PosSaleOpData, operation.timestamp)
        : service.createOrder(d);
    case 'update_order':
      return service.updateOrder(d.id as number, d);
    case 'create_product':
      return service.createProduct(d);
    case 'update_product':
      return service.updateProduct(d.id as number, d);
    case 'update_stock':
      return service.updateStock(
        d.productId as number,
        d.quantity as number,
        d.stockStatus as 'instock' | 'outofstock' | 'onbackorder'
      );
    case 'delete_product':
      return okIfGone(await service.deleteProduct(d.id as number));
    case 'batch_products':
      return runBatch((ops) => service.batchProducts(ops as never), d as BatchOps);
    case 'batch_orders':
      return runBatch((ops) => service.batchOrders(ops as never), d as BatchOps);
    case 'create_coupon':
      return service.createCoupon(d);
    case 'update_coupon':
      return service.updateCoupon(d.id as number, d);
    case 'delete_coupon':
      return okIfGone(await service.deleteCoupon(d.id as number));
    case 'batch_coupons':
      return runBatch((ops) => service.batchCoupons(ops as never), d as BatchOps);
    default:
      return { success: false, error: 'Unknown operation type' };
  }
}
