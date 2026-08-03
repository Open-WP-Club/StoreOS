import { ChangeEvent, ReactElement } from 'react';
import type { ProductFormData } from '../hooks/useProductEditForm';

interface ProductEditShippingTabProps {
  formData: ProductFormData;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
}

/**
 * Shipping tab: weight, dimensions, shipping class, virtual/downloadable toggles.
 */
export function ProductEditShippingTab({ formData, onInputChange }: ProductEditShippingTabProps): ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="product-weight" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Weight (kg)
        </label>
        <input
          id="product-weight"
          type="text"
          name="weight"
          value={formData.weight}
          onChange={onInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="0"
        />
      </div>

      <div>
        <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-4">
          Dimensions (cm)
        </span>
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label htmlFor="product-length" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Length</label>
            <input
              id="product-length"
              type="text"
              name="length"
              value={formData.length}
              onChange={onInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
            />
          </div>
          <div>
            <label htmlFor="product-width" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Width</label>
            <input
              id="product-width"
              type="text"
              name="width"
              value={formData.width}
              onChange={onInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
            />
          </div>
          <div>
            <label htmlFor="product-height" className="block text-xs text-gray-600 dark:text-gray-400 mb-1">Height</label>
            <input
              id="product-height"
              type="text"
              name="height"
              value={formData.height}
              onChange={onInputChange}
              className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="0"
            />
          </div>
        </div>
      </div>

      <div>
        <label htmlFor="shipping-class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Shipping Class
        </label>
        <input
          id="shipping-class"
          type="text"
          name="shipping_class"
          value={formData.shipping_class}
          onChange={onInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Shipping class slug"
        />
      </div>

      <div className="flex items-center space-x-6">
        <label htmlFor="virtual-product" className="flex items-center space-x-2">
          <input
            id="virtual-product"
            type="checkbox"
            name="virtual"
            checked={formData.virtual}
            onChange={onInputChange}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Virtual product</span>
        </label>
        <label htmlFor="downloadable-product" className="flex items-center space-x-2">
          <input
            id="downloadable-product"
            type="checkbox"
            name="downloadable"
            checked={formData.downloadable}
            onChange={onInputChange}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Downloadable product</span>
        </label>
      </div>
    </div>
  );
}

export default ProductEditShippingTab;
