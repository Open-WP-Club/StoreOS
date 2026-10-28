import React, { useState, useDeferredValue, ChangeEvent, KeyboardEvent } from 'react';
import { useStoreConfig, useCache, useActivityLog, useSettings } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { formatPrice } from '../utils/currency';
import { exportToCSV } from '../utils/csvExport';
import { exportTableToPDF } from '../utils/pdfExport';
import { useVirtualRows } from '../hooks/useVirtualRows';
import ExportMenu from '../components/ExportMenu';
import Pagination from '../components/Pagination';
import BulkEditModal from '../components/BulkEditModal';
import ToastContainer from '../components/ToastContainer';
import LoadingIndicator from '../components/LoadingIndicator';
import { useToast } from '../hooks/useToast';
import { useOfflineMutation } from '../hooks/useOfflineMutation';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { Trash2, Edit, RefreshCw, ImageOff } from 'lucide-react';
import type { Product, StockStatus } from '../types';
import { EMPTY_PRODUCTS } from '../constants';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

interface InventoryStats {
  total: number;
  inStock: number;
  lowStock: number;
  outOfStock: number;
}

const NOT_SYNCED = Symbol('not-synced');

const InventoryPage: React.FC = (): React.ReactElement => {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const clearCacheForType = useCache((state) => state.clearCacheForType);
  const setCachedData = useCache((state) => state.setCachedData);
  const productsFromCache = useCache((state) => state.cache.products?.data || EMPTY_PRODUCTS);
  const logActivity = useActivityLog((state) => state.logActivity);
  const lowStockThreshold = useSettings((state) => state.lowStockThreshold);
  const currentStore = getCurrentStore();
  const { toasts, showToast, removeToast } = useToast();
  const { mutate: offlineMutate } = useOfflineMutation();

  const [products, setProducts] = useState<Product[]>(productsFromCache);
  const [loading, setLoading] = useState<boolean>(productsFromCache.length === 0);
  const [error] = useState<string>('');
  const [filter, setFilter] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);

  const { loadingState } = useProgressiveLoading();
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [selectedProductIds, setSelectedProductIds] = useState<number[]>([]);
  const [bulkEditModalOpen, setBulkEditModalOpen] = useState<boolean>(false);

  // Sync products state with cache
  const [prevProductsFromCache, setPrevProductsFromCache] = useState<
    typeof productsFromCache | typeof NOT_SYNCED
  >(NOT_SYNCED);
  if (prevProductsFromCache !== productsFromCache) {
    setPrevProductsFromCache(productsFromCache);
    if (productsFromCache.length > 0) {
      setProducts(productsFromCache);
      setLoading(false);
    }
  }

  // Reset to page 1 when search term or filter changes
  const [prevSearchFilter, setPrevSearchFilter] = useState({
    searchTerm,
    filter,
  });
  if (prevSearchFilter.searchTerm !== searchTerm || prevSearchFilter.filter !== filter) {
    setPrevSearchFilter({ searchTerm, filter });
    setCurrentPage(1);
  }

  const updateStock = async (
    productId: number,
    newQuantity: number,
    stockStatus: StockStatus
  ): Promise<void> => {
    if (!currentStore) return;
    setUpdating(true);

    const oldProduct = products.find((p) => p.id === productId);

    try {
      await offlineMutate({
        operationType: 'update_stock',
        queueData: {
          id: productId,
          stock_quantity: newQuantity,
          stock_status: stockStatus,
        },
        storeId: currentStore.id,
        execute: async () => {
          const service = new WooCommerceService(currentStore);
          const result = await service.updateStock(productId, newQuantity, stockStatus);
          if (!result.success) throw new Error(result.error);
          return result;
        },
        onSuccess: async (result) => {
          const updatedProducts = products.map((p) => (p.id === productId ? result.data : p));
          setProducts(updatedProducts);
          await setCachedData('products', updatedProducts);
          logActivity({
            action: 'stock_updated',
            entityType: 'product',
            entityId: productId,
            entityName: oldProduct?.name,
            storeId: currentStore?.id ?? null,
            storeName: currentStore?.name,
            changes: {
              stock_quantity: {
                from: oldProduct?.stock_quantity,
                to: newQuantity,
              },
            },
          });
        },
        onError: (error) => showToast(`Failed to update stock: ${error}`, 'error'),
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleStockChange = (productId: number, newValue: string): void => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const quantity = parseInt(newValue) || 0;
    const stockStatus: StockStatus = quantity > 0 ? 'instock' : 'outofstock';
    updateStock(productId, quantity, stockStatus);
  };

  const deferredSearch = useDeferredValue(searchTerm);
  const getFilteredProducts = (): Product[] => {
    let filtered = products;

    // Apply stock filter
    if (filter === 'low') {
      filtered = filtered.filter(
        (p) =>
          p.stock_quantity !== null &&
          p.stock_quantity !== undefined &&
          p.stock_quantity <= lowStockThreshold
      );
    } else if (filter === 'out') {
      filtered = filtered.filter((p) => p.stock_status === 'outofstock');
    } else if (filter === 'in') {
      filtered = filtered.filter((p) => p.stock_status === 'instock');
    }

    // Apply search filter
    if (deferredSearch) {
      const searchLower = deferredSearch.toLowerCase();
      filtered = filtered.filter(
        (p) =>
          p.name.toLowerCase().includes(searchLower) ||
          (p.sku && p.sku.toLowerCase().includes(searchLower))
      );
    }

    return filtered;
  };

  const filteredProducts = getFilteredProducts();

  const handleExportCSV = (): void => {
    if (!currentStore) return;
    const columns: Array<{
      key: string;
      label: string;
      format?: (value: unknown) => string;
    }> = [
      { key: 'id', label: 'Product ID' },
      { key: 'name', label: 'Product Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'stock_quantity', label: 'Stock Quantity' },
      { key: 'stock_status', label: 'Stock Status' },
      {
        key: 'price',
        label: 'Price',
        format: (val: unknown) => formatPrice(val as string | number),
      },
      {
        key: 'regular_price',
        label: 'Regular Price',
        format: (val: unknown) => formatPrice(val as string | number),
      },
    ];

    const filename = `inventory-${currentStore.name}-${new Date().toISOString().split('T')[0] ?? ''}.csv`;
    exportToCSV(filteredProducts as unknown as Record<string, unknown>[], columns, filename);
  };

  const handleExportPDF = (): void => {
    if (!currentStore) return;
    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'name', label: 'Product Name' },
      { key: 'sku', label: 'SKU' },
      { key: 'stock_quantity', label: 'Stock' },
      { key: 'stock_status', label: 'Status' },
      {
        key: 'price',
        label: 'Price',
        format: (val: unknown) => formatPrice(val as string | number),
      },
    ];

    exportTableToPDF(filteredProducts as unknown as Record<string, unknown>[], columns, {
      title: `Inventory - ${currentStore.name}`,
    }).catch(() => showToast('PDF export failed', 'error'));
  };

  // Calculate paginated products
  const startIndex = (currentPage - 1) * pageSize;
  const endIndex = startIndex + pageSize;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);
  const {
    scrollContainer,
    enabled: virtualized,
    rows: visibleRows,
    padTop,
    padBottom,
  } = useVirtualRows(paginatedProducts);

  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newPageSize: number): void => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.checked) {
      setSelectedProductIds(visibleRows.map((p) => p.id));
    } else {
      setSelectedProductIds([]);
    }
  };

  const handleSelectProduct = (productId: number): void => {
    setSelectedProductIds((prev) => {
      if (prev.includes(productId)) {
        return prev.filter((id) => id !== productId);
      } else {
        return [...prev, productId];
      }
    });
  };

  const handleBulkEdit = (): void => {
    setBulkEditModalOpen(true);
  };

  const handleBulkDelete = async (): Promise<void> => {
    if (!currentStore) return;
    if (!window.confirm(`Are you sure you want to delete ${selectedProductIds.length} products?`)) {
      return;
    }

    try {
      const service = new WooCommerceService(currentStore);

      const deleteResult = await service.batchProducts({ delete: selectedProductIds });
      if (!deleteResult.success) throw new Error(deleteResult.error);

      const updatedProducts = products.filter((p) => !selectedProductIds.includes(p.id));
      setProducts(updatedProducts);
      await setCachedData('products', updatedProducts);
      logActivity({
        action: 'product_deleted',
        entityType: 'product',
        storeId: currentStore?.id ?? null,
        storeName: currentStore?.name,
        details: `Bulk deleted ${selectedProductIds.length} products`,
      });
      setSelectedProductIds([]);
      showToast(`Successfully deleted ${selectedProductIds.length} products`, 'success');
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Error deleting products: ${errorMessage}`, 'error');
    }
  };

  const handleBulkSave = async (
    updates: { id: number; [key: string]: unknown }[]
  ): Promise<void> => {
    if (!currentStore) return;

    // Capture snapshot of affected products for undo
    const updatedIds = updates.map((u) => u.id);
    const previousProducts = products.filter((p) => updatedIds.includes(p.id));

    await offlineMutate({
      operationType: 'update_product',
      queueData: { updates },
      storeId: currentStore.id,
      execute: async () => {
        const service = new WooCommerceService(currentStore);
        const result = await service.batchUpdateProducts(updates);
        if (!result.success) throw new Error(result.error);
        return result;
      },
      onSuccess: async (result) => {
        if (!result.data.update) {
          showToast('No products were updated', 'warning');
          return;
        }
        const updatedProducts = [...products];
        result.data.update.forEach((updatedProduct: Product) => {
          const index = updatedProducts.findIndex((p) => p.id === updatedProduct.id);
          if (index !== -1) updatedProducts[index] = updatedProduct;
        });
        setProducts(updatedProducts);
        await setCachedData('products', updatedProducts);
        logActivity({
          action: 'product_bulk_updated',
          entityType: 'product',
          storeId: currentStore?.id ?? null,
          storeName: currentStore?.name,
          details: `Bulk updated ${updates.length} products`,
        });
        setSelectedProductIds([]);
        showToast(`Successfully updated ${updates.length} products`, 'success', 5000, {
          label: 'Undo',
          onClick: async () => {
            try {
              const service = new WooCommerceService(currentStore);
              const undoUpdates = previousProducts.map((p) => ({
                id: p.id,
                stock_quantity: p.stock_quantity,
                stock_status: p.stock_status,
                regular_price: p.regular_price,
                sale_price: p.sale_price,
              }));
              const undoResult = await service.batchUpdateProducts(undoUpdates);
              if (undoResult.success) {
                const restoredProducts = [...updatedProducts];
                previousProducts.forEach((prev) => {
                  const idx = restoredProducts.findIndex((p) => p.id === prev.id);
                  if (idx !== -1) restoredProducts[idx] = prev;
                });
                setProducts(restoredProducts);
                await setCachedData('products', restoredProducts);
                showToast('Changes reverted', 'info');
              } else {
                showToast('Failed to revert changes', 'error');
              }
            } catch {
              showToast('Failed to revert changes', 'error');
            }
          },
        });
      },
      onError: (error) => showToast(`Failed to update products: ${error}`, 'error'),
    });
  };

  const getSelectedProducts = (): Product[] => {
    return products.filter((p) => selectedProductIds.includes(p.id));
  };

  const stats: InventoryStats = {
    total: products.length,
    inStock: products.filter((p) => p.stock_status === 'instock').length,
    lowStock: products.filter(
      (p) =>
        p.stock_quantity !== null &&
        p.stock_quantity !== undefined &&
        p.stock_quantity <= lowStockThreshold &&
        p.stock_quantity > 0
    ).length,
    outOfStock: products.filter((p) => p.stock_status === 'outofstock').length,
  };

  if (!currentStore) {
    return (
      <EmptyState title="No store selected" message="Please select a store to manage inventory" />
    );
  }

  return (
    <div>
      <LoadingIndicator loadingState={loadingState} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader title="Inventory Management" subtitle="Monitor and update product stock levels" />

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Products" value={stats.total} />
        <StatCard label="In Stock" value={stats.inStock} color="green" />
        <StatCard label="Low Stock" value={stats.lowStock} color="yellow" />
        <StatCard label="Out of Stock" value={stats.outOfStock} color="red" />
      </div>

      {/* Filters and Bulk Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 transition-colors">
        <div className="flex flex-col md:flex-row gap-4 mb-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search by product name or SKU..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <div>
            <select
              value={filter}
              onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilter(e.target.value)}
              className="w-full md:w-48 px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Products</option>
              <option value="in">In Stock</option>
              <option value="low">Low Stock (≤5)</option>
              <option value="out">Out of Stock</option>
            </select>
          </div>
          <ExportMenu onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          <button
            onClick={() => clearCacheForType('products')}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
            title="Refresh inventory"
          >
            <RefreshCw className={`w-4 h-4 ${loadingState.isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Bulk Actions Toolbar */}
        {selectedProductIds.length > 0 && (
          <div className="flex items-center justify-between p-3 bg-blue-50 border border-blue-200 rounded-md">
            <span className="text-sm font-medium text-blue-900">
              {selectedProductIds.length} product
              {selectedProductIds.length !== 1 ? 's' : ''} selected
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleBulkEdit}
                className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700"
              >
                <Edit className="w-4 h-4" />
                Bulk Edit
              </button>
              <button
                onClick={handleBulkDelete}
                className="flex items-center gap-2 px-3 py-1.5 bg-red-600 text-white text-sm rounded-md hover:bg-red-700"
              >
                <Trash2 className="w-4 h-4" />
                Delete Selected
              </button>
              <button
                onClick={() => setSelectedProductIds([])}
                className="px-3 py-1.5 bg-gray-200 text-gray-700 text-sm rounded-md hover:bg-gray-300"
              >
                Clear Selection
              </button>
            </div>
          </div>
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading inventory...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          {error}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors">
          <div
            ref={scrollContainer}
            className={virtualized ? 'overflow-auto max-h-[70vh]' : 'overflow-x-auto'}
          >
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead
                className={`bg-gray-50 dark:bg-gray-700${virtualized ? ' sticky top-0 z-10' : ''}`}
              >
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    <input
                      type="checkbox"
                      checked={
                        selectedProductIds.length === paginatedProducts.length &&
                        paginatedProducts.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stock Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stock Quantity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {padTop > 0 && (
                  <tr aria-hidden="true" style={{ height: padTop }}>
                    <td colSpan={99} className="p-0" />
                  </tr>
                )}
                {paginatedProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No products found
                    </td>
                  </tr>
                ) : (
                  paginatedProducts.map((product) => {
                    const isLowStock =
                      product.stock_quantity !== null &&
                      product.stock_quantity !== undefined &&
                      product.stock_quantity <= lowStockThreshold &&
                      product.stock_quantity > 0;
                    const isOutOfStock = product.stock_status === 'outofstock';

                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          isOutOfStock
                            ? 'bg-red-50 dark:bg-red-900/20'
                            : isLowStock
                              ? 'bg-yellow-50 dark:bg-yellow-900/20'
                              : ''
                        }`}
                      >
                        <td className="px-6 py-4">
                          <input
                            type="checkbox"
                            checked={selectedProductIds.includes(product.id)}
                            onChange={() => handleSelectProduct(product.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 dark:border-gray-600 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {product.images && product.images.length > 0 ? (
                              <div className="w-10 h-10 rounded mr-3 flex-shrink-0">
                                <img
                                  src={product.images[0]?.src}
                                  alt={product.name}
                                  className="w-10 h-10 object-cover rounded"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    const placeholder =
                                      target.nextElementSibling as HTMLElement | null;
                                    if (placeholder) placeholder.style.display = 'flex';
                                  }}
                                />
                                <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded items-center justify-center hidden">
                                  <ImageOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                                </div>
                              </div>
                            ) : (
                              <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded mr-3 flex items-center justify-center">
                                <ImageOff className="w-5 h-5 text-gray-400 dark:text-gray-500" />
                              </div>
                            )}
                            <div>
                              <p className="text-sm font-medium text-gray-900 dark:text-white">
                                {product.name}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.sku || 'N/A'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {formatPrice(product.price)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              product.stock_status === 'instock'
                                ? 'bg-green-100 text-green-800'
                                : product.stock_status === 'outofstock'
                                  ? 'bg-red-100 text-red-800'
                                  : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {product.stock_status}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {product.manage_stock ? (
                            <span
                              className={
                                isLowStock
                                  ? 'text-yellow-600 dark:text-yellow-400 font-semibold'
                                  : isOutOfStock
                                    ? 'text-red-600 dark:text-red-400 font-semibold'
                                    : ''
                              }
                            >
                              {product.stock_quantity}
                            </span>
                          ) : (
                            'Not managed'
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                          {product.manage_stock && (
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                defaultValue={product.stock_quantity ?? 0}
                                onBlur={(e: React.FocusEvent<HTMLInputElement>) => {
                                  const newValue = e.target.value;
                                  if (newValue !== String(product.stock_quantity)) {
                                    handleStockChange(product.id, newValue);
                                  }
                                }}
                                onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
                                  if (e.key === 'Enter') {
                                    const target = e.target as HTMLInputElement;
                                    handleStockChange(product.id, target.value);
                                    target.blur();
                                  }
                                }}
                                className="w-20 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded text-center"
                                disabled={updating}
                              />
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
                {padBottom > 0 && (
                  <tr aria-hidden="true" style={{ height: padBottom }}>
                    <td colSpan={99} className="p-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {filteredProducts.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredProducts.length}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      )}

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={bulkEditModalOpen}
        onClose={() => setBulkEditModalOpen(false)}
        selectedProducts={getSelectedProducts()}
        onSave={handleBulkSave as React.ComponentProps<typeof BulkEditModal>['onSave']}
        onError={(msg: string) => showToast(msg, 'error')}
      />
    </div>
  );
};

export default InventoryPage;
