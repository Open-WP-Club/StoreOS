import { ChangeEvent, ReactElement } from 'react';
import type { ProductFormData } from '../hooks/useProductEditForm';

interface ProductEditInventoryTabProps {
  formData: ProductFormData;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

/**
 * Inventory tab: SKU, stock management toggle, stock quantity, stock status.
 */
export function ProductEditInventoryTab({ formData, onInputChange }: ProductEditInventoryTabProps): ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="product-sku" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          SKU (Stock Keeping Unit)
        </label>
        <input
          id="product-sku"
          type="text"
          name="sku"
          value={formData.sku}
          onChange={onInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter SKU"
        />
      </div>

      <div>
        <label htmlFor="manage-stock" className="flex items-center space-x-2 mb-4">
          <input
            id="manage-stock"
            type="checkbox"
            name="manage_stock"
            checked={formData.manage_stock}
            onChange={onInputChange}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
          />
          <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Manage stock?</span>
        </label>
        <p className="text-sm text-gray-500 dark:text-gray-400">Enable stock management at product level</p>
      </div>

      {formData.manage_stock && (
        <div>
          <label htmlFor="stock-quantity" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Stock Quantity
          </label>
          <input
            id="stock-quantity"
            type="number"
            name="stock_quantity"
            value={formData.stock_quantity}
            onChange={onInputChange}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0"
          />
        </div>
      )}

      <div>
        <label htmlFor="stock-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Stock Status
        </label>
        <select
          id="stock-status"
          name="stock_status"
          value={formData.stock_status}
          onChange={onInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="instock">In Stock</option>
          <option value="outofstock">Out of Stock</option>
          <option value="onbackorder">On Backorder</option>
        </select>
      </div>
    </div>
  );
}

export default ProductEditInventoryTab;
