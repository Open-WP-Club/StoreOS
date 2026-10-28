import { useState, useCallback } from 'react';
import { useStoreConfig, useCache, useSettings, useActivityLog } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { batchErrorIds } from '../utils/batchResult';
import type { Product, StockStatus, ProductUpdateData, BatchProductUpdate } from '../types';

interface EditData {
  name: string;
  price: string;
  regular_price: string;
  sale_price: string;
  stock_quantity: number | string;
  stock_status: StockStatus;
  description: string;
  short_description: string;
}


interface UseProductActionsResult {
  selectedProduct: Product | null;
  editMode: boolean;
  editData: EditData;
  quickEditId: number | null;
  quickEditPrice: string;
  updating: boolean;
  selectedProductIds: number[];
  bulkEditModalOpen: boolean;
  setSelectedProduct: (product: Product | null) => void;
  setEditMode: (mode: boolean) => void;
  setEditData: (data: EditData) => void;
  setQuickEditId: (id: number | null) => void;
  setQuickEditPrice: (price: string) => void;
  setSelectedProductIds: (ids: number[]) => void;
  setBulkEditModalOpen: (open: boolean) => void;
  handleEdit: (product: Product) => void;
  handleSave: (products: Product[], setProducts: (p: Product[]) => void) => Promise<void>;
  handleDelete: (productId: number, products: Product[], setProducts: (p: Product[]) => void) => Promise<void>;
  handleDuplicate: (product: Product, products: Product[], setProducts: (p: Product[]) => void) => Promise<void>;
  handleQuickEditPrice: (productId: number, products: Product[], setProducts: (p: Product[]) => void) => Promise<void>;
  handleBulkDelete: (products: Product[], setProducts: (p: Product[]) => void) => Promise<void>;
  handleBulkSave: (updates: BatchProductUpdate[], products: Product[], setProducts: (p: Product[]) => void) => Promise<void>;
  handleSelectProduct: (productId: number) => void;
  handleSelectAll: (paginatedProducts: Product[], checked: boolean) => void;
  getSelectedProducts: (products: Product[]) => Product[];
  showToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

/**
 * Hook encapsulating product CRUD operations: edit, save, delete, duplicate,
 * quick-edit price, bulk edit, bulk delete, and selection management.
 */
export function useProductActions(
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
): UseProductActionsResult {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const refreshProducts = useSettings((state) => state.refreshProducts);
  const setCachedData = useCache((state) => state.setCachedData);
  const logActivity = useActivityLog((state) => state.logActivity);
  const currentStore = getCurrentStore();

  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [editMode, setEditMode] = useState<boolean>(false);
  const [editData, setEditData] = useState<EditData>({
    name: '',
    price: '',
    regular_price: '',
    sale_price: '',
    stock_quantity: '',
    stock_status: 'instock',
    description: '',
    short_description: '',
  });
  const [quickEditId, setQuickEditId] = useState<number | null>(null);
  const [quickEditPrice, setQuickEditPrice] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState<boolean>(false);

  const handleEdit = (product: Product): void => {
    setSelectedProduct(product);
    setEditMode(true);
    setEditData({
      name: product.name || '',
      price: product.price || '',
      regular_price: product.regular_price || '',
      sale_price: product.sale_price || '',
      stock_quantity: product.stock_quantity ?? '',
      stock_status: product.stock_status || 'instock',
      description: product.description || '',
      short_description: product.short_description || '',
    });
  };

  const handleSave = async (products: Product[], setProducts: (p: Product[]) => void): Promise<void> => {
    if (!selectedProduct || !currentStore) return;

    try {
      const service = new WooCommerceService(currentStore);
      const updateData: ProductUpdateData = {
        name: editData.name,
        regular_price: editData.regular_price,
        sale_price: editData.sale_price,
        stock_quantity: typeof editData.stock_quantity === 'string' ? parseInt(editData.stock_quantity) || null : editData.stock_quantity,
        stock_status: editData.stock_status,
        description: editData.description,
        short_description: editData.short_description,
      };
      const result = await service.updateProduct(selectedProduct.id, updateData);

      if (result.success) {
        const updatedProducts = products.map((product) =>
          product.id === selectedProduct.id ? result.data : product
        ) as Product[];
        setProducts(updatedProducts);
        await setCachedData('products', updatedProducts);

        const latestModified = result.data.date_modified_gmt || result.data.date_modified;
        useCache.setState((state) => ({
          cache: {
            ...state.cache,
            products: {
              ...state.cache.products,
              data: updatedProducts,
              lastSync: latestModified,
            },
          },
        }));

        setEditMode(false);
        setSelectedProduct(null);
        logActivity({
          action: 'product_updated',
          entityType: 'product',
          entityId: selectedProduct.id,
          entityName: editData.name,
          storeId: currentStore?.id ?? null,
          storeName: currentStore?.name,
          details: 'Product details updated',
        });
        showToast('Product updated successfully', 'success');
      } else {
        showToast(`Failed to update product: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDelete = async (productId: number, products: Product[], setProducts: (p: Product[]) => void): Promise<void> => {
    if (!window.confirm('Are you sure you want to delete this product?') || !currentStore) return;

    try {
      const service = new WooCommerceService(currentStore);
      const result = await service.deleteProduct(productId);

      if (result.success) {
        const deletedProduct = products.find((p) => p.id === productId);
        const updatedProducts = products.filter((product) => product.id !== productId);
        setProducts(updatedProducts);
        await setCachedData('products', updatedProducts);
        setSelectedProduct(null);
        setEditMode(false);
        logActivity({
          action: 'product_deleted',
          entityType: 'product',
          entityId: productId,
          entityName: deletedProduct?.name,
          storeId: currentStore?.id ?? null,
          storeName: currentStore?.name,
        });
        showToast('Product deleted successfully', 'success');
      } else if (!result.success) {
        showToast(`Failed to delete product: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleDuplicate = async (product: Product, products: Product[], setProducts: (p: Product[]) => void): Promise<void> => {
    if (!window.confirm(`Duplicate "${product.name}"?`) || !currentStore) return;

    try {
      const service = new WooCommerceService(currentStore);

      const duplicateData = {
        name: `${product.name} (Copy)`,
        type: product.type,
        status: 'draft' as const,
        description: product.description,
        short_description: product.short_description,
        sku: '',
        regular_price: product.regular_price,
        sale_price: product.sale_price,
        categories: product.categories,
        images: product.images,
        attributes: product.attributes,
        stock_quantity: product.stock_quantity,
        stock_status: product.stock_status,
        manage_stock: product.manage_stock,
      };

      const result = await service.createProduct(duplicateData);

      if (result.success) {
        const updatedProducts = [result.data as Product, ...products];
        setProducts(updatedProducts);
        await setCachedData('products', updatedProducts);
        logActivity({
          action: 'product_created',
          entityType: 'product',
          entityId: (result.data as Product).id,
          entityName: (result.data as Product).name,
          storeId: currentStore?.id ?? null,
          storeName: currentStore?.name,
          details: `Duplicated from "${product.name}"`,
        });
        showToast('Product duplicated successfully! Edit the duplicate to publish.', 'success');
        refreshProducts?.();
      } else {
        showToast(`Failed to duplicate product: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    }
  };

  const handleQuickEditPrice = async (productId: number, products: Product[], setProducts: (p: Product[]) => void): Promise<void> => {
    if (!quickEditPrice || !currentStore) return;

    setUpdating(true);
    try {
      const service = new WooCommerceService(currentStore);
      const result = await service.updateProduct(productId, { regular_price: quickEditPrice });

      if (result.success) {
        const updatedProducts = products.map((product) =>
          product.id === productId ? result.data : product
        ) as Product[];
        setProducts(updatedProducts);
        await setCachedData('products', updatedProducts);

        const latestModified = result.data.date_modified_gmt || result.data.date_modified;
        useCache.setState((state) => ({
          cache: {
            ...state.cache,
            products: {
              ...state.cache.products,
              data: updatedProducts,
              lastSync: latestModified,
            },
          },
        }));

        setQuickEditId(null);
        setQuickEditPrice('');
        logActivity({
          action: 'product_updated',
          entityType: 'product',
          entityId: productId,
          entityName: result.data.name,
          storeId: currentStore?.id ?? null,
          storeName: currentStore?.name,
          details: 'Price updated',
          changes: { regular_price: { from: products.find((p) => p.id === productId)?.regular_price, to: quickEditPrice } },
        });
        showToast('Price updated successfully', 'success');
      } else {
        showToast(`Failed to update price: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setUpdating(false);
    }
  };

  const handleBulkDelete = async (products: Product[], setProducts: (p: Product[]) => void): Promise<void> => {
    if (
      !window.confirm(`Are you sure you want to delete ${selectedProductIds.length} products?`) ||
      !currentStore
    ) {
      return;
    }

    try {
      const service = new WooCommerceService(currentStore);
<<<<<<< HEAD
      const deleteResult = await service.batchProducts({ delete: selectedProductIds });
      if (!deleteResult.success) throw new Error(deleteResult.error);
=======
      const results = await Promise.all(selectedProductIds.map((id) => service.deleteProduct(id)));
      const deletedIds = selectedProductIds.filter((_, i) => results[i]?.success);
      const failedCount = selectedProductIds.length - deletedIds.length;
      if (deletedIds.length === 0) {
        showToast(`Error deleting products: ${failedCount} of ${selectedProductIds.length} failed`, 'error');
        return;
      }
>>>>>>> 4ab4dcf (wip: bulk ops partial-failure handling and coupon bulk delete)

      const updatedProducts = products.filter((p) => !deletedIds.includes(p.id));
      setProducts(updatedProducts);
      await setCachedData('products', updatedProducts);
      logActivity({
        action: 'product_deleted',
        entityType: 'product',
        storeId: currentStore?.id ?? null,
        storeName: currentStore?.name,
        details: `Bulk deleted ${deletedIds.length} products`,
      });
      setSelectedProductIds(selectedProductIds.filter((id) => !deletedIds.includes(id)));
      if (failedCount > 0) {
        showToast(`${failedCount} of ${selectedProductIds.length} products failed to delete`, 'warning');
      } else {
        showToast(`Successfully deleted ${deletedIds.length} products`, 'success');
      }
    } catch (err) {
      showToast(
        `Error deleting products: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error'
      );
    }
  };

  const handleBulkSave = async (updates: BatchProductUpdate[], products: Product[], setProducts: (p: Product[]) => void): Promise<void> => {
    if (!currentStore) return;

    try {
      const service = new WooCommerceService(currentStore);
      const result = await service.batchUpdateProducts(updates);

      if (result.success) {
        const failedIds = batchErrorIds(result.data, 'update');
        if (result.data?.update) {
          const updatedProducts = [...products];
          result.data.update.forEach((updatedProduct: Product) => {
            if (failedIds.includes(updatedProduct.id)) return;
            const index = updatedProducts.findIndex((p) => p.id === updatedProduct.id);
            if (index !== -1) {
              updatedProducts[index] = updatedProduct;
            }
          });

          setProducts(updatedProducts);
          await setCachedData('products', updatedProducts);
        }
        logActivity({
          action: 'product_bulk_updated',
          entityType: 'product',
          storeId: currentStore?.id ?? null,
          storeName: currentStore?.name,
          details: `Bulk updated ${updates.length} products`,
        });
        setSelectedProductIds([]);
        if (failedIds.length > 0) {
          showToast(`${failedIds.length} of ${updates.length} products failed to update`, 'warning');
        } else {
          showToast(`Successfully updated ${updates.length} products`, 'success');
        }
      } else {
        showToast(`Failed to update products: ${result.error}`, 'error');
      }
    } catch (err) {
      showToast(
        `Error updating products: ${err instanceof Error ? err.message : 'Unknown error'}`,
        'error'
      );
    }
  };

  const handleSelectProduct = useCallback((productId: number): void => {
    setSelectedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  }, []);

  const handleSelectAll = (paginatedProducts: Product[], checked: boolean): void => {
    if (checked) {
      setSelectedProductIds(paginatedProducts.map((p) => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const getSelectedProducts = (products: Product[]): Product[] => {
    return products.filter((p) => selectedProductIds.includes(p.id));
  };

  return {
    selectedProduct,
    editMode,
    editData,
    quickEditId,
    quickEditPrice,
    updating,
    selectedProductIds,
    bulkEditModalOpen,
    setSelectedProduct,
    setEditMode,
    setEditData,
    setQuickEditId,
    setQuickEditPrice,
    setSelectedProductIds,
    setBulkEditModalOpen,
    handleEdit,
    handleSave,
    handleDelete,
    handleDuplicate,
    handleQuickEditPrice,
    handleBulkDelete,
    handleBulkSave,
    handleSelectProduct,
    handleSelectAll,
    getSelectedProducts,
    showToast,
  };
}

export default useProductActions;
