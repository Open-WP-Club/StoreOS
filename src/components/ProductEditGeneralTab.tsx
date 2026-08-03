import { ChangeEvent, ReactElement, RefObject } from 'react';
import { Code, Eye } from 'lucide-react';
import VisualEditor from './VisualEditor';
import type { ProductFormData, EditorMode } from '../hooks/useProductEditForm';

interface ProductEditGeneralTabProps {
  formData: ProductFormData;
  descriptionMode: EditorMode;
  shortDescriptionMode: EditorMode;
  descriptionRef: RefObject<HTMLDivElement | null>;
  shortDescriptionRef: RefObject<HTMLDivElement | null>;
  onInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  onVisualEditorBlur: (field: 'description' | 'short_description') => void;
  onModeSwitch: (field: 'description' | 'short_description', newMode: EditorMode) => void;
}

/**
 * General tab: product name, descriptions (visual/code editors), pricing, featured toggle.
 */
export function ProductEditGeneralTab({
  formData,
  descriptionMode,
  shortDescriptionMode,
  descriptionRef,
  shortDescriptionRef,
  onInputChange,
  onVisualEditorBlur,
  onModeSwitch,
}: ProductEditGeneralTabProps): ReactElement {
  return (
    <div className="space-y-6">
      <div>
        <label htmlFor="product-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Product Name
        </label>
        <input
          id="product-name"
          type="text"
          name="name"
          value={formData.name}
          onChange={onInputChange}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          placeholder="Enter product name"
        />
      </div>

      {/* Description Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="product-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Description
          </label>
          <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
            <button
              type="button"
              onClick={() => onModeSwitch('description', 'visual')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                descriptionMode === 'visual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Eye className="w-3 h-3" />
              Visual
            </button>
            <button
              type="button"
              onClick={() => onModeSwitch('description', 'code')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                descriptionMode === 'code'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Code className="w-3 h-3" />
              Code
            </button>
          </div>
        </div>
        {descriptionMode === 'visual' ? (
          <VisualEditor
            editorRef={descriptionRef}
            content={formData.description}
            onBlur={() => onVisualEditorBlur('description')}
            minHeight="200px"
          />
        ) : (
          <textarea
            id="product-description"
            name="description"
            value={formData.description}
            onChange={onInputChange}
            rows={8}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Enter product description (HTML)"
          />
        )}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {descriptionMode === 'visual' ? 'Click to edit. Formatting is preserved.' : 'Edit raw HTML code'}
        </p>
      </div>

      {/* Short Description Editor */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label htmlFor="product-short-desc" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            Short Description
          </label>
          <div className="flex rounded-md overflow-hidden border border-gray-300 dark:border-gray-600">
            <button
              type="button"
              onClick={() => onModeSwitch('short_description', 'visual')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                shortDescriptionMode === 'visual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Eye className="w-3 h-3" />
              Visual
            </button>
            <button
              type="button"
              onClick={() => onModeSwitch('short_description', 'code')}
              className={`flex items-center gap-1 px-3 py-1 text-xs font-medium transition-colors ${
                shortDescriptionMode === 'code'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
              }`}
            >
              <Code className="w-3 h-3" />
              Code
            </button>
          </div>
        </div>
        {shortDescriptionMode === 'visual' ? (
          <VisualEditor
            editorRef={shortDescriptionRef}
            content={formData.short_description}
            onBlur={() => onVisualEditorBlur('short_description')}
            minHeight="100px"
          />
        ) : (
          <textarea
            id="product-short-desc"
            name="short_description"
            value={formData.short_description}
            onChange={onInputChange}
            rows={4}
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            placeholder="Enter short description (HTML)"
          />
        )}
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          {shortDescriptionMode === 'visual' ? 'Brief excerpt shown in product listings' : 'Edit raw HTML code'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="regular-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Regular Price ($)
          </label>
          <input
            id="regular-price"
            type="number"
            name="regular_price"
            value={formData.regular_price}
            onChange={onInputChange}
            step="0.01"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>

        <div>
          <label htmlFor="sale-price" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            Sale Price ($)
          </label>
          <input
            id="sale-price"
            type="number"
            name="sale_price"
            value={formData.sale_price}
            onChange={onInputChange}
            step="0.01"
            className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0.00"
          />
        </div>
      </div>

      <div className="flex items-center space-x-4">
        <label htmlFor="featured-product" className="flex items-center space-x-2">
          <input
            id="featured-product"
            type="checkbox"
            name="featured"
            checked={formData.featured}
            onChange={onInputChange}
            className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500 dark:bg-gray-700"
          />
          <span className="text-sm text-gray-700 dark:text-gray-300">Featured product</span>
        </label>
      </div>
    </div>
  );
}

export default ProductEditGeneralTab;
