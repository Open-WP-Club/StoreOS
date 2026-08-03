import React, { useCallback, ChangeEvent, KeyboardEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStoreConfig, useCache, useSettings } from '../stores';
import { formatPrice } from '../utils/currency';
import Pagination from '../components/Pagination';
import BulkEditModal from '../components/BulkEditModal';
import ToastContainer from '../components/ToastContainer';
import LoadingIndicator from '../components/LoadingIndicator';
import ProductsFilterBar from '../components/ProductsFilterBar';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { useProductFilters } from '../hooks/useProductFilters';
import { useProductActions } from '../hooks/useProductActions';
import { useProductExport } from '../hooks/useProductExport';
import { Trash2, Edit, Copy, ImageOff } from 'lucide-react';
import type { Product, StockStatus, BatchProductUpdate } from '../types';
import { EMPTY_PRODUCTS } from '../constants';

function ProductsPage(): React.ReactElement {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const refreshProducts = useSettings((state) => state.refreshProducts);
  const lowStockThreshold = useSettings((state) => state.lowStockThreshold);
  const productsFromCache = useCache((state) => state.cache.products?.data || EMPTY_PRODUCTS);
  const currentStore = getCurrentStore();
  const { toasts, showToast, removeToast } = useToast();

  const setCachedData = useCache((state) => state.setCachedData);
  const products = productsFromCache;
  const loading = productsFromCache.length === 0 && !currentStore;
  const error = '';

  // Provide a setProducts that updates the cache store
  const setProducts = useCallback((updatedProducts: Product[]) => {
    setCachedData('products', updatedProducts);
  }, [setCachedData]);

  const { loadingState } = useProgressiveLoading();
  const filtersHook = useProductFilters(products);
  const actions = useProductActions(showToast);
  const exportHook = useProductExport();

  if (!currentStore) {
    return <EmptyState title="No store selected" message="Please select a store to view products" />;
  }

  return (
    <div>
      <LoadingIndicator loadingState={loadingState} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader title="Products" subtitle="Manage your store products" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Products" value={filtersHook.stats.total} />
        <StatCard label="In Stock" value={filtersHook.stats.inStock} color="green" />
        <StatCard label="Low Stock" value={filtersHook.stats.lowStock} color="yellow" />
        <StatCard label="Out of Stock" value={filtersHook.stats.outOfStock} color="red" />
      </div>

      <ProductsFilterBar
        searchTerm={filtersHook.searchTerm}
        onSearchTermChange={(value) => {
          filtersHook.setSearchTerm(value);
          if (value.trim() !== '') {
            filtersHook.setSearchParams({ search: value });
          } else {
            filtersHook.setSearchParams({});
          }
        }}
        onSearchParamsUpdate={() => {/* handled above */}}
        filters={filtersHook.filters}
        onFiltersChange={filtersHook.setFilters}
        showAdvancedFilters={filtersHook.showAdvancedFilters}
        onToggleAdvancedFilters={() => filtersHook.setShowAdvancedFilters(!filtersHook.showAdvancedFilters)}
        hasActiveFilters={filtersHook.hasActiveFilters}
        filteredProductsCount={filtersHook.filteredProducts.length}
        totalProductsCount={products.length}
        onClearAllFilters={filtersHook.clearAllFilters}
        onApplyPreset={(presetFilters) => filtersHook.handleApplyPreset(presetFilters, showToast)}
        onExportCSV={() => exportHook.handleExportCSV(filtersHook.filteredProducts)}
        onExportPDF={() => exportHook.handleExportPDF(filtersHook.filteredProducts)}
        onRefresh={() => refreshProducts?.()}
        isLoading={loadingState.isLoading}
        selectedProductIds={actions.selectedProductIds}
        onBulkEdit={() => actions.setBulkEditModalOpen(true)}
        onBulkDelete={() => actions.handleBulkDelete(products, setProducts)}
        onClearSelection={() => actions.setSelectedProductIds([])}
        showToast={showToast}
      />

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading products...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          {error}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={
                        actions.selectedProductIds.length === filtersHook.paginatedProducts.length &&
                        filtersHook.paginatedProducts.length > 0
                      }
                      onChange={(e) => actions.handleSelectAll(filtersHook.paginatedProducts, e.target.checked)}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Product
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    SKU
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Stock Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider w-24">
                    Stock Qty
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {filtersHook.paginatedProducts.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No products found
                    </td>
                  </tr>
                ) : (
                  filtersHook.paginatedProducts.map((product) => {
                    const isLowStock =
                      product.stock_quantity !== null &&
                      product.stock_quantity <= lowStockThreshold &&
                      product.stock_quantity > 0;
                    const isOutOfStock = product.stock_status === 'outofstock';

                    return (
                      <tr
                        key={product.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
                          isOutOfStock
                            ? 'bg-red-50 dark:bg-red-900/10'
                            : isLowStock
                            ? 'bg-yellow-50 dark:bg-yellow-900/10'
                            : ''
                        }`}
                      >
                        <td className="px-3 py-4 whitespace-nowrap">
                          <input
                            type="checkbox"
                            checked={actions.selectedProductIds.includes(product.id)}
                            onChange={() => actions.handleSelectProduct(product.id)}
                            className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                          />
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex items-center">
                            {product.images?.length > 0 ? (
                              <div className="w-10 h-10 rounded mr-3 flex-shrink-0">
                                <img
                                  src={product.images[0]?.src}
                                  alt={product.name}
                                  className="w-10 h-10 object-cover rounded"
                                  onError={(e) => {
                                    const target = e.currentTarget;
                                    target.style.display = 'none';
                                    const placeholder = target.nextElementSibling as HTMLElement | null;
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
                              <Link
                                to={`/products/${product.id}`}
                                className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                              >
                                {product.name}
                              </Link>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {product.sku || 'N/A'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                          {actions.quickEditId === product.id ? (
                            <div className="flex items-center space-x-2">
                              <input
                                type="number"
                                step="0.01"
                                value={actions.quickEditPrice}
                                onChange={(e: ChangeEvent<HTMLInputElement>) =>
                                  actions.setQuickEditPrice(e.target.value)
                                }
                                onKeyPress={(e: KeyboardEvent<HTMLInputElement>) => {
                                  if (e.key === 'Enter') {
                                    actions.handleQuickEditPrice(product.id, products, setProducts);
                                  }
                                }}
                                className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-center"
                                disabled={actions.updating}
                              />
                              <button
                                onClick={() => actions.handleQuickEditPrice(product.id, products, setProducts)}
                                className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-xs"
                                disabled={actions.updating}
                              >
                                Save
                              </button>
                              <button
                                onClick={() => {
                                  actions.setQuickEditId(null);
                                  actions.setQuickEditPrice('');
                                }}
                                className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 text-xs"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                actions.setQuickEditId(product.id);
                                actions.setQuickEditPrice(product.regular_price || product.price);
                              }}
                              className="text-left hover:text-blue-600 dark:hover:text-blue-400"
                            >
                              {formatPrice(product.price)}
                            </button>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              product.stock_status === 'instock'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : product.stock_status === 'outofstock'
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400'
                            }`}
                          >
                            {product.stock_status}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
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
                        <td className="px-4 py-4 whitespace-nowrap text-sm space-x-2">
                          <Link
                            to={`/products/${product.id}`}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                            Edit
                          </Link>
                          <button
                            onClick={() => actions.handleDuplicate(product, products, setProducts)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                            Clone
                          </button>
                          <button
                            onClick={() => actions.handleDelete(product.id, products, setProducts)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filtersHook.filteredProducts.length > 0 && (
            <Pagination
              currentPage={filtersHook.currentPage}
              totalItems={filtersHook.filteredProducts.length}
              pageSize={filtersHook.pageSize}
              onPageChange={filtersHook.handlePageChange}
              onPageSizeChange={filtersHook.handlePageSizeChange}
            />
          )}
        </div>
      )}

      {/* Product Details/Edit Modal */}
      {actions.selectedProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <h3 className="text-2xl font-bold text-gray-900">
                  {actions.editMode ? 'Edit Product' : 'Product Details'}
                </h3>
                <button
                  onClick={() => {
                    actions.setSelectedProduct(null);
                    actions.setEditMode(false);
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg
                    className="w-6 h-6"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </button>
              </div>

              {actions.editMode ? (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="modal-product-name" className="block text-sm font-medium text-gray-700 mb-1">
                      Product Name
                    </label>
                    <input
                      id="modal-product-name"
                      type="text"
                      value={actions.editData.name}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        actions.setEditData({ ...actions.editData, name: e.target.value })
                      }
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="modal-regular-price" className="block text-sm font-medium text-gray-700 mb-1">
                        Regular Price
                      </label>
                      <input
                        id="modal-regular-price"
                        type="number"
                        step="0.01"
                        value={actions.editData.regular_price}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          actions.setEditData({ ...actions.editData, regular_price: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-sale-price" className="block text-sm font-medium text-gray-700 mb-1">
                        Sale Price
                      </label>
                      <input
                        id="modal-sale-price"
                        type="number"
                        step="0.01"
                        value={actions.editData.sale_price}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          actions.setEditData({ ...actions.editData, sale_price: e.target.value })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="modal-stock-qty" className="block text-sm font-medium text-gray-700 mb-1">
                        Stock Quantity
                      </label>
                      <input
                        id="modal-stock-qty"
                        type="number"
                        value={actions.editData.stock_quantity}
                        onChange={(e: ChangeEvent<HTMLInputElement>) =>
                          actions.setEditData({ ...actions.editData, stock_quantity: parseInt(e.target.value) || 0 })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      />
                    </div>
                    <div>
                      <label htmlFor="modal-stock-status" className="block text-sm font-medium text-gray-700 mb-1">
                        Stock Status
                      </label>
                      <select
                        id="modal-stock-status"
                        value={actions.editData.stock_status}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                          actions.setEditData({ ...actions.editData, stock_status: e.target.value as StockStatus })
                        }
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      >
                        <option value="instock">In Stock</option>
                        <option value="outofstock">Out of Stock</option>
                        <option value="onbackorder">On Backorder</option>
                      </select>
                    </div>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <button
                      onClick={() => actions.handleSave(products, setProducts)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Save Changes
                    </button>
                    <button
                      onClick={() => actions.setEditMode(false)}
                      className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="space-y-6">
                  {actions.selectedProduct.images?.length > 0 && (
                    <img
                      src={actions.selectedProduct.images[0]?.src}
                      alt={actions.selectedProduct.name}
                      className="w-full h-64 object-cover rounded-md"
                    />
                  )}

                  <div>
                    <h4 className="font-semibold text-gray-900 mb-2">Product Information</h4>
                    <div className="bg-gray-50 p-4 rounded-md space-y-2">
                      <p className="text-sm">
                        <span className="font-medium">ID:</span> {actions.selectedProduct.id}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">SKU:</span> {actions.selectedProduct.sku || 'N/A'}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Price:</span>{' '}
                        {formatPrice(actions.selectedProduct.price)}
                      </p>
                      <p className="text-sm">
                        <span className="font-medium">Stock:</span>{' '}
                        {actions.selectedProduct.stock_quantity ?? 'N/A'} ({actions.selectedProduct.stock_status})
                      </p>
                    </div>
                  </div>

                  {actions.selectedProduct.description && (
                    <div>
                      <h4 className="font-semibold text-gray-900 mb-2">Description</h4>
                      <div
                        className="bg-gray-50 p-4 rounded-md text-sm prose prose-sm max-w-none"
                        dangerouslySetInnerHTML={{ __html: actions.selectedProduct.description }}
                      />
                    </div>
                  )}

                  <div className="flex gap-3">
                    <button
                      onClick={() => actions.handleEdit(actions.selectedProduct!)}
                      className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                    >
                      Edit Product
                    </button>
                    <button
                      onClick={() => actions.handleDelete(actions.selectedProduct!.id, products, setProducts)}
                      className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={actions.bulkEditModalOpen}
        onClose={() => actions.setBulkEditModalOpen(false)}
        selectedProducts={actions.getSelectedProducts(products)}
        allProducts={products}
        onSave={(updates) => actions.handleBulkSave(updates as BatchProductUpdate[], products, setProducts)}
        onError={(msg: string) => showToast(msg, 'error')}
      />
    </div>
  );
}

export default ProductsPage;
