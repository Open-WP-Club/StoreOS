import { useState } from 'react';
import { useCache, useActivityLog, useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { useOfflineMutation } from './useOfflineMutation';
import type { Product, StockStatus } from '../types';

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
  updateStock: (id: number, qty: number, status: StockStatus) => Promise<void>;
  applyStockCount: (changes: Array<{ productId: number; counted: number }>) => Promise<void>;
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
  ): Promise<void> => {
    if (!currentStore) return;
    setUpdating(true);
    const oldProduct = getProducts().find((p) => p.id === productId);
    try {
      await offlineMutate({
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
    } finally {
      setUpdating(false);
    }
  };

  const applyStockCount = async (
    changes: Array<{ productId: number; counted: number }>
  ): Promise<void> => {
    for (const c of changes) {
      await updateStock(c.productId, c.counted, c.counted > 0 ? 'instock' : 'outofstock');
    }
  };

  return { updateStock, applyStockCount, updating };
}
