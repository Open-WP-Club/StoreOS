import { ChangeEvent, ReactElement } from 'react';
import type { ProductFormData } from '../hooks/useProductEditForm';

interface ProductEditAdvancedTabProps {
  formData: ProductFormData;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

/**
 * Advanced tab: purchase note, menu order, tax settings, catalog visibility.
 */
export function ProductEditAdvancedTab({ formData, onInputChange }: ProductEditAdvancedTabProps): ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="purchase-note" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Purchase Note
        </label>
        <textarea
          id="purchase-note"
          name="purchase_note"
          value={formData.purchase_note}
          onChange={onInputChange}
          rows={4}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter notes that will be sent to customer after purchase"
        />
      </div>

      <div>
        <label htmlFor="menu-order" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Menu Order
        </label>
        <input
          id="menu-order"
          type="number"
          name="menu_order"
          value={formData.menu_order}
          onChange={onInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="0"
        />
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">Custom ordering position</p>
      </div>

      <div>
        <label htmlFor="tax-status" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tax Status
        </label>
        <select
          id="tax-status"
          name="tax_status"
          value={formData.tax_status}
          onChange={onInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="taxable">Taxable</option>
          <option value="shipping">Shipping only</option>
          <option value="none">None</option>
        </select>
      </div>

      <div>
        <label htmlFor="tax-class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Tax Class
        </label>
        <input
          id="tax-class"
          type="text"
          name="tax_class"
          value={formData.tax_class}
          onChange={onInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Standard, reduced-rate, zero-rate"
        />
      </div>

      <div>
        <label htmlFor="catalog-visibility" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Catalog Visibility
        </label>
        <select
          id="catalog-visibility"
          name="catalog_visibility"
          value={formData.catalog_visibility}
          onChange={onInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="visible">Shop and search results</option>
          <option value="catalog">Shop only</option>
          <option value="search">Search results only</option>
          <option value="hidden">Hidden</option>
        </select>
      </div>
    </div>
  );
}

export default ProductEditAdvancedTab;
