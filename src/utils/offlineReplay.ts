import { replayPosSale, type PosSaleOpData } from './posOfflineSale';
import { isPlaceholderId } from './offlinePlaceholders';
import { batchErrorIds } from './batchResult';
import {
  createProductOnce,
  createCouponOnce,
  createCategoryOnce,
  createAttributeOnce,
  createTermOnce,
  createTaxRateOnce,
  createTaxClassOnce,
  createVariationOnce,
  createOrderOnce,
} from './offlineCreates';
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
 * Every create replay is guarded: lookup by client id (POS sale, product, variation), SKU, code, or name/slug.
 */
export async function replayOperation(
  service: WooCommerceService,
  operation: PendingOperation
): Promise<Result> {
  const d = operation.data;
  // Safety net: a temp placeholder id must never reach the API.
  const batchIds = operation.type.startsWith('batch_')
    ? [
        ...((d.update as Array<{ id?: unknown }> | undefined) ?? []).map((u) => u.id),
        ...((d.delete as unknown[] | undefined) ?? []),
      ]
    : [];
  if (
    (!operation.type.startsWith('create_') && isPlaceholderId(d.id)) ||
    batchIds.some(isPlaceholderId) ||
    isPlaceholderId(d.productId) ||
    isPlaceholderId(d.attributeId)
  ) {
    return { success: false, error: 'Refusing to sync a pending placeholder id' };
  }
  switch (operation.type) {
    case 'create_order':
      return typeof d.clientId === 'string'
        ? replayPosSale(service, d as PosSaleOpData, operation.timestamp)
        : createOrderOnce(service, d, operation.timestamp);
    case 'update_order':
      return service.updateOrder(d.id as number, d);
    case 'create_product':
      return createProductOnce(service, d, operation.timestamp);
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
      return createCouponOnce(service, d);
    case 'update_coupon':
      return service.updateCoupon(d.id as number, d);
    case 'delete_coupon':
      return okIfGone(await service.deleteCoupon(d.id as number));
    case 'batch_coupons':
      return runBatch((ops) => service.batchCoupons(ops as never), d as BatchOps);
    case 'create_category':
      return createCategoryOnce(service, d);
    case 'update_category':
      return okIfGone(await service.updateProductCategory(d.id as number, d));
    case 'delete_category':
      return okIfGone(await service.deleteProductCategory(d.id as number));
    case 'create_attribute':
      return createAttributeOnce(service, d);
    case 'update_attribute':
      return okIfGone(await service.updateProductAttribute(d.id as number, d));
    case 'delete_attribute':
      return okIfGone(await service.deleteProductAttribute(d.id as number));
    case 'create_attribute_term':
      return createTermOnce(service, d);
    case 'update_attribute_term':
      return okIfGone(
        await service.updateAttributeTerm(d.attributeId as number, d.id as number, d)
      );
    case 'delete_attribute_term':
      return okIfGone(await service.deleteAttributeTerm(d.attributeId as number, d.id as number));
    case 'create_tax_rate':
      return createTaxRateOnce(service, d);
    case 'update_tax_rate':
      return okIfGone(await service.updateTaxRate(d.id as number, d));
    case 'delete_tax_rate':
      return okIfGone(await service.deleteTaxRate(d.id as number));
    case 'create_tax_class':
      return createTaxClassOnce(service, d);
    case 'delete_tax_class':
      return okIfGone(await service.deleteTaxClass(d.slug as string));
    case 'update_review':
      return okIfGone(await service.updateReview(d.id as number, d));
    case 'delete_review':
      return okIfGone(await service.deleteReview(d.id as number));
    case 'batch_reviews': {
      const res = await service.batchUpdateReviews(d.update as never);
      if (!res.success) return okIfGone(res);
      const failed = batchErrorIds(res.data, 'update').length;
      return failed
        ? { success: false, error: `${failed} batch item(s) failed` }
        : { success: true };
    }
    case 'create_variation':
      return createVariationOnce(service, d);
    case 'update_variation':
      return okIfGone(
        await service.updateProductVariation(d.productId as number, d.id as number, d)
      );
    case 'delete_variation':
      return okIfGone(await service.deleteProductVariation(d.productId as number, d.id as number));
    case 'batch_variations': {
      const { productId, ...ops } = d;
      return runBatch(
        (o) => service.batchProductVariations(productId as number, o as never),
        ops as BatchOps
      );
    }
    default:
      return { success: false, error: 'Unknown operation type' };
  }
}
