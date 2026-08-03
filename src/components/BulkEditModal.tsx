import React, { useState, useMemo, useCallback } from 'react';
import { X, ChevronRight, ChevronLeft, AlertTriangle } from 'lucide-react';
import type { WooCommerceProduct, StockStatus, TaxStatus, CatalogVisibility, ProductCategory } from '../types';

type PriceAction = 'set' | 'increase' | 'decrease';
type PriceType = 'fixed' | 'percent';

interface EditFields {
  // Price fields
  changePrice: boolean;
  priceAction: PriceAction;
  priceValue: string;
  priceType: PriceType;

  // Sale price fields
  changeSalePrice: boolean;
  salePriceAction: PriceAction;
  salePriceValue: string;
  salePriceType: PriceType;
  saleDateFrom: string;
  saleDateTo: string;

  // Stock fields
  changeStock: boolean;
  stockAction: PriceAction;
  stockValue: string;

  // Stock status
  changeStockStatus: boolean;
  stockStatus: StockStatus;

  // Stock management
  changeManageStock: boolean;
  manageStock: boolean;

  // Tax status
  changeTaxStatus: boolean;
  taxStatus: TaxStatus;

  // Catalog visibility
  changeCatalogVisibility: boolean;
  catalogVisibility: CatalogVisibility;

  // Shipping class
  changeShippingClass: boolean;
  shippingClass: string;

  // Featured
  changeFeatured: boolean;
  featured: boolean;

  // Categories
  changeCategories: boolean;
  categories: string;

  // Tags
  changeTags: boolean;
  tags: string;
}

interface ProductUpdate {
  id: number;
  regular_price?: string;
  sale_price?: string;
  date_on_sale_from?: string | null;
  date_on_sale_to?: string | null;
  stock_quantity?: number;
  manage_stock?: boolean;
  stock_status?: StockStatus;
  tax_status?: TaxStatus;
  catalog_visibility?: CatalogVisibility;
  shipping_class?: string;
  featured?: boolean;
  categories?: Array<{ id: number }>;
  tags?: Array<{ id: number }>;
}

interface PreviewRow {
  id: number;
  name: string;
  oldRegularPrice: string;
  newRegularPrice: string | null;
  oldSalePrice: string;
  newSalePrice: string | null;
}

interface BulkEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedProducts: WooCommerceProduct[];
  allProducts?: WooCommerceProduct[];
  onSave: (updates: ProductUpdate[]) => Promise<void>;
  onError?: (message: string) => void;
}

const INPUT_CLS =
  'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
const INPUT_DISABLED_CLS = `${INPUT_CLS} disabled:bg-gray-100 dark:disabled:bg-gray-600`;

const BulkEditModal: React.FC<BulkEditModalProps> = ({
  isOpen,
  onClose,
  selectedProducts,
  allProducts,
  onSave,
  onError,
}) => {
  const [editFields, setEditFields] = useState<EditFields>({
    changePrice: false,
    priceAction: 'set',
    priceValue: '',
    priceType: 'fixed',

    changeSalePrice: false,
    salePriceAction: 'set',
    salePriceValue: '',
    salePriceType: 'fixed',
    saleDateFrom: '',
    saleDateTo: '',

    changeStock: false,
    stockAction: 'set',
    stockValue: '',

    changeStockStatus: false,
    stockStatus: 'instock',

    changeManageStock: false,
    manageStock: true,

    changeTaxStatus: false,
    taxStatus: 'taxable',

    changeCatalogVisibility: false,
    catalogVisibility: 'visible',

    changeShippingClass: false,
    shippingClass: '',

    changeFeatured: false,
    featured: false,

    changeCategories: false,
    categories: '',

    changeTags: false,
    tags: '',
  });

  // Category filter state
  const [filterByCategory, setFilterByCategory] = useState<boolean>(false);
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');

  // Preview step
  const [showPreview, setShowPreview] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);

  // Derive available categories from allProducts or selectedProducts
  const availableCategories = useMemo<ProductCategory[]>(() => {
    const source = allProducts ?? selectedProducts;
    const map = new Map<number, ProductCategory>();
    source.forEach((p) => {
      (p.categories ?? []).forEach((c) => {
        if (!map.has(c.id)) map.set(c.id, c);
      });
    });
    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [allProducts, selectedProducts]);

  // Effective products: filtered by category or the original selection
  const effectiveProducts = useMemo<WooCommerceProduct[]>(() => {
    if (filterByCategory && selectedCategoryId !== '') {
      const source = allProducts ?? selectedProducts;
      return source.filter((p) =>
        (p.categories ?? []).some((c) => c.id === selectedCategoryId)
      );
    }
    return selectedProducts;
  }, [filterByCategory, selectedCategoryId, allProducts, selectedProducts]);

  const handleFieldToggle = useCallback((field: keyof EditFields): void => {
    setEditFields((prev) => ({ ...prev, [field]: !prev[field] }));
  }, []);

  const handleFieldChange = useCallback(<K extends keyof EditFields>(field: K, value: EditFields[K]): void => {
    setEditFields((prev) => ({ ...prev, [field]: value }));
  }, []);

  const calculateNewValue = useCallback((
    currentValue: string | number,
    action: PriceAction,
    value: string,
    type: PriceType
  ): string => {
    const current = parseFloat(String(currentValue)) || 0;
    const changeValue = parseFloat(value) || 0;
    if (action === 'set') return value;
    if (action === 'increase') {
      return type === 'percent'
        ? (current * (1 + changeValue / 100)).toFixed(2)
        : (current + changeValue).toFixed(2);
    }
    // decrease
    return type === 'percent'
      ? (current * (1 - changeValue / 100)).toFixed(2)
      : Math.max(0, current - changeValue).toFixed(2);
  }, []);

  const buildUpdates = useCallback((): ProductUpdate[] =>
    effectiveProducts.map((product) => {
      const update: ProductUpdate = { id: product.id };

      if (editFields.changePrice && editFields.priceValue) {
        update.regular_price = calculateNewValue(
          product.regular_price,
          editFields.priceAction,
          editFields.priceValue,
          editFields.priceType
        );
      }

      if (editFields.changeSalePrice && editFields.salePriceValue) {
        update.sale_price = calculateNewValue(
          product.sale_price || product.regular_price,
          editFields.salePriceAction,
          editFields.salePriceValue,
          editFields.salePriceType
        );
        if (editFields.saleDateFrom) update.date_on_sale_from = editFields.saleDateFrom;
        if (editFields.saleDateTo) update.date_on_sale_to = editFields.saleDateTo;
      }

      if (editFields.changeStock && editFields.stockValue !== '') {
        const currentStock = product.stock_quantity || 0;
        if (editFields.stockAction === 'set') {
          update.stock_quantity = parseInt(editFields.stockValue);
        } else if (editFields.stockAction === 'increase') {
          update.stock_quantity = currentStock + parseInt(editFields.stockValue);
        } else {
          update.stock_quantity = Math.max(0, currentStock - parseInt(editFields.stockValue));
        }
        update.manage_stock = true;
      }

      if (editFields.changeStockStatus) update.stock_status = editFields.stockStatus;
      if (editFields.changeManageStock) update.manage_stock = editFields.manageStock;
      if (editFields.changeTaxStatus) update.tax_status = editFields.taxStatus;
      if (editFields.changeCatalogVisibility) update.catalog_visibility = editFields.catalogVisibility;
      if (editFields.changeShippingClass) update.shipping_class = editFields.shippingClass;
      if (editFields.changeFeatured) update.featured = editFields.featured;

      if (editFields.changeCategories && editFields.categories) {
        update.categories = editFields.categories
          .split(',')
          .map((cat) => ({ id: parseInt(cat.trim()) }))
          .filter((cat) => !isNaN(cat.id));
      }

      if (editFields.changeTags && editFields.tags) {
        update.tags = editFields.tags
          .split(',')
          .map((tag) => ({ id: parseInt(tag.trim()) }))
          .filter((tag) => !isNaN(tag.id));
      }

      return update;
    }), [effectiveProducts, editFields, calculateNewValue]);

  const buildPreviewRows = useCallback((): PreviewRow[] => {
    const updates = buildUpdates();
    return effectiveProducts.map((p) => {
      const u = updates.find((x) => x.id === p.id);
      return {
        id: p.id,
        name: p.name,
        oldRegularPrice: p.regular_price || '—',
        newRegularPrice: u?.regular_price ?? null,
        oldSalePrice: p.sale_price || '—',
        newSalePrice: u?.sale_price ?? null,
      };
    });
  }, [buildUpdates, effectiveProducts]);

  const handlePreview = useCallback((): void => {
    if (effectiveProducts.length === 0) return;
    setShowPreview(true);
  }, [effectiveProducts.length]);

  const handleSave = useCallback(async (): Promise<void> => {
    setIsSaving(true);
    try {
      await onSave(buildUpdates());
      onClose();
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error('Error saving bulk edits:', error);
      if (onError) onError('Failed to save bulk edits. Please try again.');
    } finally {
      setIsSaving(false);
    }
  }, [onSave, buildUpdates, onClose, onError]);

  const handleCategoryIdChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>): void => {
    setSelectedCategoryId(e.target.value === '' ? '' : parseInt(e.target.value));
  }, []);

  const handleSetFilterByCategory = useCallback((value: boolean): void => {
    setFilterByCategory(value);
  }, []);

  const handleBackFromPreview = useCallback((): void => {
    setShowPreview(false);
  }, []);

  if (!isOpen) return null;

  // ── Preview screen ──────────────────────────────────────────────────────────
  if (showPreview) {
    const rows = buildPreviewRows();
    const priceChanges = rows.filter((r) => r.newRegularPrice !== null || r.newSalePrice !== null);

    return (
      <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              Preview Changes — {effectiveProducts.length} products
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
              aria-label="Close modal"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-6">
            {/* Warning if no price changes visible */}
            {priceChanges.length === 0 && (
              <div className="flex items-start gap-2 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-4 mb-4">
                <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5 shrink-0" />
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  No price changes selected. Other fields (stock, visibility, etc.) will still be updated.
                </p>
              </div>
            )}

            {/* Sale date range summary */}
            {editFields.changeSalePrice && (editFields.saleDateFrom || editFields.saleDateTo) && (
              <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-3 mb-4 text-sm text-blue-900 dark:text-blue-300">
                Sale period:{' '}
                <strong>{editFields.saleDateFrom || '—'}</strong>
                {' → '}
                <strong>{editFields.saleDateTo || '—'}</strong>
              </div>
            )}

            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-700 text-left text-gray-500 dark:text-gray-400">
                    <th className="pb-2 font-medium">Product</th>
                    {(editFields.changePrice) && (
                      <>
                        <th className="pb-2 font-medium px-3">Regular Price</th>
                        <th className="pb-2 font-medium px-3">→ New</th>
                      </>
                    )}
                    {(editFields.changeSalePrice) && (
                      <>
                        <th className="pb-2 font-medium px-3">Sale Price</th>
                        <th className="pb-2 font-medium px-3">→ New</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-gray-100 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-700/50"
                    >
                      <td className="py-2 text-gray-900 dark:text-white font-medium truncate max-w-[200px]">
                        {row.name}
                      </td>
                      {editFields.changePrice && (
                        <>
                          <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                            {row.oldRegularPrice}
                          </td>
                          <td className="py-2 px-3 font-semibold text-green-700 dark:text-green-400">
                            {row.newRegularPrice ?? '—'}
                          </td>
                        </>
                      )}
                      {editFields.changeSalePrice && (
                        <>
                          <td className="py-2 px-3 text-gray-500 dark:text-gray-400">
                            {row.oldSalePrice}
                          </td>
                          <td className="py-2 px-3 font-semibold text-green-700 dark:text-green-400">
                            {row.newSalePrice ?? '—'}
                          </td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
            <button
              onClick={handleBackFromPreview}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500"
            >
              <ChevronLeft className="w-4 h-4" />
              Back
            </button>
            <button
              onClick={handleSave}
              disabled={isSaving || effectiveProducts.length === 0}
              className="px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-md hover:bg-blue-700 disabled:opacity-50"
            >
              {isSaving ? 'Saving...' : `Confirm — Update ${effectiveProducts.length} Products`}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Edit screen ─────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 bg-black/50 dark:bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
            Bulk Edit Products
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
            aria-label="Close modal"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Instructions */}
          <div className="bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-300">
              <strong>Instructions:</strong> Check the fields you want to edit, then specify the
              changes. Only checked fields will be updated.
            </p>
          </div>

          {/* ── Category Filter Section ─────────────────────────────────────── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
              Scope
            </h3>

            <div className="flex items-center gap-3 mb-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="radio"
                  name="scope"
                  checked={!filterByCategory}
                  onChange={() => handleSetFilterByCategory(false)}
                  className="w-4 h-4 text-blue-600"
                />
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Selected products ({selectedProducts.length})
                </span>
              </label>
              {allProducts && availableCategories.length > 0 && (
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="scope"
                    checked={filterByCategory}
                    onChange={() => handleSetFilterByCategory(true)}
                    className="w-4 h-4 text-blue-600"
                  />
                  <span className="text-sm text-gray-700 dark:text-gray-300">
                    All products in category
                  </span>
                </label>
              )}
            </div>

            {filterByCategory && (
              <div className="flex items-center gap-3 ml-6">
                <select
                  value={selectedCategoryId}
                  onChange={handleCategoryIdChange}
                  className={INPUT_CLS}
                >
                  <option value="">— Choose category —</option>
                  {availableCategories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {selectedCategoryId !== '' && (
                  <span className="text-sm text-gray-500 dark:text-gray-400">
                    {effectiveProducts.length} products
                  </span>
                )}
              </div>
            )}
          </div>

          {/* ── Price Section ───────────────────────────────────────────────── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Pricing</h3>

            {/* Regular Price */}
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="changePrice"
                  checked={editFields.changePrice}
                  onChange={() => handleFieldToggle('changePrice')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="changePrice" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Regular Price
                </label>
              </div>
              {editFields.changePrice && (
                <div className="ml-6 grid grid-cols-3 gap-2">
                  <select
                    value={editFields.priceAction}
                    onChange={(e) => handleFieldChange('priceAction', e.target.value as PriceAction)}
                    className={INPUT_CLS}
                  >
                    <option value="set">Set to</option>
                    <option value="increase">Increase by</option>
                    <option value="decrease">Decrease by</option>
                  </select>
                  <input
                    type="number"
                    step="0.01"
                    value={editFields.priceValue}
                    onChange={(e) => handleFieldChange('priceValue', e.target.value)}
                    placeholder="Value"
                    className={INPUT_CLS}
                  />
                  <select
                    value={editFields.priceType}
                    onChange={(e) => handleFieldChange('priceType', e.target.value as PriceType)}
                    disabled={editFields.priceAction === 'set'}
                    className={INPUT_DISABLED_CLS}
                  >
                    <option value="fixed">Fixed amount</option>
                    <option value="percent">Percentage</option>
                  </select>
                </div>
              )}
            </div>

            {/* Sale Price */}
            <div>
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="changeSalePrice"
                  checked={editFields.changeSalePrice}
                  onChange={() => handleFieldToggle('changeSalePrice')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="changeSalePrice" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Sale Price
                </label>
              </div>
              {editFields.changeSalePrice && (
                <div className="ml-6 space-y-3">
                  <div className="grid grid-cols-3 gap-2">
                    <select
                      value={editFields.salePriceAction}
                      onChange={(e) => handleFieldChange('salePriceAction', e.target.value as PriceAction)}
                      className={INPUT_CLS}
                    >
                      <option value="set">Set to</option>
                      <option value="increase">Increase by</option>
                      <option value="decrease">Decrease by</option>
                    </select>
                    <input
                      type="number"
                      step="0.01"
                      value={editFields.salePriceValue}
                      onChange={(e) => handleFieldChange('salePriceValue', e.target.value)}
                      placeholder="Value"
                      className={INPUT_CLS}
                    />
                    <select
                      value={editFields.salePriceType}
                      onChange={(e) => handleFieldChange('salePriceType', e.target.value as PriceType)}
                      disabled={editFields.salePriceAction === 'set'}
                      className={INPUT_DISABLED_CLS}
                    >
                      <option value="fixed">Fixed amount</option>
                      <option value="percent">Percentage</option>
                    </select>
                  </div>

                  {/* Sale date range */}
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label htmlFor="bulk-sale-date-from" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Sale start date (optional)
                      </label>
                      <input
                        id="bulk-sale-date-from"
                        type="date"
                        value={editFields.saleDateFrom}
                        onChange={(e) => handleFieldChange('saleDateFrom', e.target.value)}
                        className={INPUT_CLS + ' w-full'}
                      />
                    </div>
                    <div>
                      <label htmlFor="bulk-sale-date-to" className="block text-xs text-gray-500 dark:text-gray-400 mb-1">
                        Sale end date (optional)
                      </label>
                      <input
                        id="bulk-sale-date-to"
                        type="date"
                        value={editFields.saleDateTo}
                        min={editFields.saleDateFrom || undefined}
                        onChange={(e) => handleFieldChange('saleDateTo', e.target.value)}
                        className={INPUT_CLS + ' w-full'}
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ── Stock Section ───────────────────────────────────────────────── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Inventory</h3>

            {/* Stock Quantity */}
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="changeStock"
                  checked={editFields.changeStock}
                  onChange={() => handleFieldToggle('changeStock')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="changeStock" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stock Quantity
                </label>
              </div>
              {editFields.changeStock && (
                <div className="ml-6 grid grid-cols-2 gap-2">
                  <select
                    value={editFields.stockAction}
                    onChange={(e) => handleFieldChange('stockAction', e.target.value as PriceAction)}
                    className={INPUT_CLS}
                  >
                    <option value="set">Set to</option>
                    <option value="increase">Increase by</option>
                    <option value="decrease">Decrease by</option>
                  </select>
                  <input
                    type="number"
                    value={editFields.stockValue}
                    onChange={(e) => handleFieldChange('stockValue', e.target.value)}
                    placeholder="Quantity"
                    className={INPUT_CLS}
                  />
                </div>
              )}
            </div>

            {/* Stock Status */}
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="changeStockStatus"
                  checked={editFields.changeStockStatus}
                  onChange={() => handleFieldToggle('changeStockStatus')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="changeStockStatus" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Stock Status
                </label>
              </div>
              {editFields.changeStockStatus && (
                <div className="ml-6">
                  <select
                    value={editFields.stockStatus}
                    onChange={(e) => handleFieldChange('stockStatus', e.target.value as StockStatus)}
                    className={`w-full ${INPUT_CLS}`}
                  >
                    <option value="instock">In stock</option>
                    <option value="outofstock">Out of stock</option>
                    <option value="onbackorder">On backorder</option>
                  </select>
                </div>
              )}
            </div>

            {/* Manage Stock */}
            <div>
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="changeManageStock"
                  checked={editFields.changeManageStock}
                  onChange={() => handleFieldToggle('changeManageStock')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="changeManageStock" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Enable Stock Management
                </label>
              </div>
              {editFields.changeManageStock && (
                <div className="ml-6">
                  <select
                    value={String(editFields.manageStock)}
                    onChange={(e) => handleFieldChange('manageStock', e.target.value === 'true')}
                    className={`w-full ${INPUT_CLS}`}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              )}
            </div>
          </div>

          {/* ── Product Data Section ────────────────────────────────────────── */}
          <div className="border border-gray-200 dark:border-gray-700 rounded-lg p-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Product Data</h3>

            {/* Tax Status */}
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="changeTaxStatus"
                  checked={editFields.changeTaxStatus}
                  onChange={() => handleFieldToggle('changeTaxStatus')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="changeTaxStatus" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Tax Status
                </label>
              </div>
              {editFields.changeTaxStatus && (
                <div className="ml-6">
                  <select
                    value={editFields.taxStatus}
                    onChange={(e) => handleFieldChange('taxStatus', e.target.value as TaxStatus)}
                    className={`w-full ${INPUT_CLS}`}
                  >
                    <option value="taxable">Taxable</option>
                    <option value="shipping">Shipping only</option>
                    <option value="none">None</option>
                  </select>
                </div>
              )}
            </div>

            {/* Catalog Visibility */}
            <div className="mb-4">
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="changeCatalogVisibility"
                  checked={editFields.changeCatalogVisibility}
                  onChange={() => handleFieldToggle('changeCatalogVisibility')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="changeCatalogVisibility" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Catalog Visibility
                </label>
              </div>
              {editFields.changeCatalogVisibility && (
                <div className="ml-6">
                  <select
                    value={editFields.catalogVisibility}
                    onChange={(e) => handleFieldChange('catalogVisibility', e.target.value as CatalogVisibility)}
                    className={`w-full ${INPUT_CLS}`}
                  >
                    <option value="visible">Shop and search results</option>
                    <option value="catalog">Shop only</option>
                    <option value="search">Search results only</option>
                    <option value="hidden">Hidden</option>
                  </select>
                </div>
              )}
            </div>

            {/* Featured */}
            <div>
              <div className="flex items-center mb-2">
                <input
                  type="checkbox"
                  id="changeFeatured"
                  checked={editFields.changeFeatured}
                  onChange={() => handleFieldToggle('changeFeatured')}
                  className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                />
                <label htmlFor="changeFeatured" className="ml-2 text-sm font-medium text-gray-700 dark:text-gray-300">
                  Featured Product
                </label>
              </div>
              {editFields.changeFeatured && (
                <div className="ml-6">
                  <select
                    value={String(editFields.featured)}
                    onChange={(e) => handleFieldChange('featured', e.target.value === 'true')}
                    className={`w-full ${INPUT_CLS}`}
                  >
                    <option value="true">Yes</option>
                    <option value="false">No</option>
                  </select>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700/50">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            {effectiveProducts.length} product{effectiveProducts.length !== 1 ? 's' : ''} will be updated
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-600 border border-gray-300 dark:border-gray-500 rounded-md hover:bg-gray-50 dark:hover:bg-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
            >
              Cancel
            </button>
            <button
              onClick={handlePreview}
              disabled={effectiveProducts.length === 0}
              className="flex items-center gap-1 px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
            >
              Preview Changes
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default React.memo(BulkEditModal);
