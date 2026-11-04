import { useState } from 'react';
import { useCache, useActivityLog, useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { costMeta } from '../utils/costPrice';
import { useOfflineMutation } from './useOfflineMutation';
import type { Product, ProductUpdateData, StockStatus } from '../types';

interface Options {
  /** Latest products (must reflect earlier sequential updates). */
  getProducts: () => Product[];
  /** Called with the updated list after each successful update. */
  setProducts: (p: Product[]) => void;
  showToast: (msg: string, type: 'error' | 'success' | 'info' | 'warning') => void;
}

/**
 * The offline-aware stock update path shared by InventoryPage (stock count / receive stock)
 * and PurchaseOrdersPage (receiving a PO).
 */
export function useStockUpdater({ getProducts, setProducts, showToast }: Options): {
  /** Resolves true when the update succeeded or was queued offline. */
  updateStock: (id: number, qty: number, status: StockStatus) => Promise<boolean>;
  /** Resolves true only if every change succeeded or was queued. */
  applyStockCount: (changes: Array<{ productId: number; counted: number }>) => Promise<boolean>;
  /** Writes the unit cost to the product's cost meta (offline-aware). Same true/false contract. */
  updateCost: (productId: number, unitCost: number) => Promise<boolean>;
  updating: boolean;
} {
  const currentStore = useStoreConfig((s) => s.getCurrentStore());
  const setCachedData = useCache((s) => s.setCachedData);
  const logActivity = useActivityLog((s) => s.logActivity);
  const { mutate: offlineMutate } = useOfflineMutation();
  const [updating, setUpdating] = useState(false);

  const updateStock = async (
    productId: number,
    newQuantity: number,
    stockStatus: StockStatus
  ): Promise<boolean> => {
    if (!currentStore) return false;
    setUpdating(true);
    const oldProduct = getProducts().find((p) => p.id === productId);
    try {
      const res = await offlineMutate({
        operationType: 'update_stock',
        queueData: { id: productId, stock_quantity: newQuantity, stock_status: stockStatus },
        storeId: currentStore.id,
        execute: async () => {
          const service = new WooCommerceService(currentStore);
          const result = await service.updateStock(productId, newQuantity, stockStatus);
          if (!result.success) throw new Error(result.error);
          return result;
        },
        onSuccess: async (result) => {
          // Latest list as base so sequential updates don't overwrite each other
          const updated = getProducts().map((p) => (p.id === productId ? result.data : p));
          setProducts(updated);
          await setCachedData('products', updated);
          logActivity({
            action: 'stock_updated',
            entityType: 'product',
            entityId: productId,
            entityName: oldProduct?.name,
            storeId: currentStore.id ?? null,
            storeName: currentStore.name,
            changes: { stock_quantity: { from: oldProduct?.stock_quantity, to: newQuantity } },
          });
        },
        onError: (error) => showToast(`Failed to update stock: ${error}`, 'error'),
      });
      return res.success || res.queued;
    } finally {
      setUpdating(false);
    }
  };

  const applyStockCount = async (
    changes: Array<{ productId: number; counted: number }>
  ): Promise<boolean> => {
    let ok = true;
    for (const c of changes) {
      ok =
        (await updateStock(c.productId, c.counted, c.counted > 0 ? 'instock' : 'outofstock')) && ok;
    }
    return ok;
  };

  const updateCost = async (productId: number, unitCost: number): Promise<boolean> => {
    if (!currentStore) return false;
    const meta_data = [costMeta(unitCost)];
    const res = await offlineMutate({
      operationType: 'update_product',
      queueData: { id: productId, meta_data },
      storeId: currentStore.id,
      execute: async () => {
        const result = await new WooCommerceService(currentStore).updateProduct(productId, {
          // WooCommerce matches meta by key; the id is only present on existing entries
          meta_data: meta_data as unknown as ProductUpdateData['meta_data'],
        });
        if (!result.success) throw new Error(result.error);
        return result;
      },
      onSuccess: async (result) => {
        const updated = getProducts().map((p) => (p.id === productId ? result.data : p));
        setProducts(updated);
        await setCachedData('products', updated);
      },
      onError: (error) => showToast(`Failed to update cost: ${error}`, 'error'),
    });
    return res.success || res.queued;
  };

  return { updateStock, applyStockCount, updateCost, updating };
}
