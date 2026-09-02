import React from 'react';
import { X, ChevronRight } from 'lucide-react';
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

interface BulkEditFormProps {
  editFields: EditFields;
  onFieldToggle: (field: keyof EditFields) => void;
  onFieldChange: <K extends keyof EditFields>(field: K, value: EditFields[K]) => void;
  filterByCategory: boolean;
  selectedCategoryId: number | '';
  availableCategories: ProductCategory[];
  effectiveProducts: WooCommerceProduct[];
  selectedProducts: WooCommerceProduct[];
  allProducts?: WooCommerceProduct[];
  onCategoryIdChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onSetFilterByCategory: (value: boolean) => void;
  onClose: () => void;
  onPreview: () => void;
}

const INPUT_CLS =
  'border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500';
const INPUT_DISABLED_CLS = `${INPUT_CLS} disabled:bg-gray-100 dark:disabled:bg-gray-600`;

const BulkEditForm: React.FC<BulkEditFormProps> = ({
  editFields,
  onFieldToggle,
  onFieldChange,
  filterByCategory,
  selectedCategoryId,
  availableCategories,
  effectiveProducts,
  selectedProducts,
  allProducts,
  onCategoryIdChange,
  onSetFilterByCategory,
  onClose,
  onPreview,
}) => {
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
                  onChange={() => onSetFilterByCategory(false)}
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
                    onChange={() => onSetFilterByCategory(true)}
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
                  onChange={onCategoryIdChange}
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
                  onChange={() => onFieldToggle('changePrice')}
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
                    onChange={(e) => onFieldChange('priceAction', e.target.value as PriceAction)}
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
                    onChange={(e) => onFieldChange('priceValue', e.target.value)}
                    placeholder="Value"
                    className={INPUT_CLS}
                  />
                  <select
                    value={editFields.priceType}
                    onChange={(e) => onFieldChange('priceType', e.target.value as PriceType)}
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
                  onChange={() => onFieldToggle('changeSalePrice')}
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
                      onChange={(e) => onFieldChange('salePriceAction', e.target.value as PriceAction)}
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
                      onChange={(e) => onFieldChange('salePriceValue', e.target.value)}
                      placeholder="Value"
                      className={INPUT_CLS}
                    />
                    <select
                      value={editFields.salePriceType}
                      onChange={(e) => onFieldChange('salePriceType', e.target.value as PriceType)}
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
                        onChange={(e) => onFieldChange('saleDateFrom', e.target.value)}
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
                        onChange={(e) => onFieldChange('saleDateTo', e.target.value)}
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
                  onChange={() => onFieldToggle('changeStock')}
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
                    onChange={(e) => onFieldChange('stockAction', e.target.value as PriceAction)}
                    className={INPUT_CLS}
                  >
                    <option value="set">Set to</option>
                    <option value="increase">Increase by</option>
                    <option value="decrease">Decrease by</option>
                  </select>
                  <input
                    type="number"
                    value={editFields.stockValue}
                    onChange={(e) => onFieldChange('stockValue', e.target.value)}
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
                  onChange={() => onFieldToggle('changeStockStatus')}
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
                    onChange={(e) => onFieldChange('stockStatus', e.target.value as StockStatus)}
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
                  onChange={() => onFieldToggle('changeManageStock')}
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
                    onChange={(e) => onFieldChange('manageStock', e.target.value === 'true')}
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
                  onChange={() => onFieldToggle('changeTaxStatus')}
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
                    onChange={(e) => onFieldChange('taxStatus', e.target.value as TaxStatus)}
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
                  onChange={() => onFieldToggle('changeCatalogVisibility')}
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
                    onChange={(e) => onFieldChange('catalogVisibility', e.target.value as CatalogVisibility)}
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
                  onChange={() => onFieldToggle('changeFeatured')}
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
                    onChange={(e) => onFieldChange('featured', e.target.value === 'true')}
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
              onClick={onPreview}
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

export default BulkEditForm;
