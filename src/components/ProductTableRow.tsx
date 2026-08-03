import React, { memo, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { Trash2, Edit, Copy } from 'lucide-react';
import { formatPrice } from '../utils/currency';
import useSettings from '../stores/settingsStore';
import type { WooCommerceProduct } from '../types';

interface ProductTableRowProps {
  product: WooCommerceProduct;
  isSelected: boolean;
  onSelect: (productId: number) => void;
  onDelete: (productId: number) => void;
  onDuplicate: (product: WooCommerceProduct) => void;
  onQuickEditSave: (productId: number, newPrice: string) => Promise<void>;
}

/**
 * Memoized ProductTableRow component
 * Only re-renders when product data, selection state, or callbacks change
 *
 * Uses internal state for quick edit mode to keep the interface simple.
 * The onQuickEditSave callback is called with (productId, newPrice) when save is clicked.
 */
const ProductTableRow = memo(function ProductTableRow({
  product,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onQuickEditSave,
}: ProductTableRowProps): React.ReactElement {
  const lowStockThreshold = useSettings((state) => state.lowStockThreshold);
  const [quickEditMode, setQuickEditMode] = useState<boolean>(false);
  const [quickEditPrice, setQuickEditPrice] = useState<string>('');
  const [updating, setUpdating] = useState<boolean>(false);

  const isLowStock =
    product.stock_quantity !== null &&
    product.stock_quantity <= lowStockThreshold &&
    product.stock_quantity > 0;
  const isOutOfStock = product.stock_status === 'outofstock';

  const handleQuickEditStart = useCallback((): void => {
    setQuickEditMode(true);
    setQuickEditPrice(product.regular_price || product.price || '');
  }, [product.regular_price, product.price]);

  const handleQuickEditSaveClick = useCallback(async (): Promise<void> => {
    if (!quickEditPrice) return;

    setUpdating(true);
    try {
      await onQuickEditSave(product.id, quickEditPrice);
      setQuickEditMode(false);
      setQuickEditPrice('');
    } finally {
      setUpdating(false);
    }
  }, [product.id, quickEditPrice, onQuickEditSave]);

  const handleQuickEditCancel = useCallback((): void => {
    setQuickEditMode(false);
    setQuickEditPrice('');
  }, []);

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    if (e.key === 'Enter') {
      handleQuickEditSaveClick();
    }
  };

  return (
    <tr
      className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${
        isOutOfStock
          ? 'bg-red-50 dark:bg-red-900/10'
          : isLowStock
            ? 'bg-yellow-50 dark:bg-yellow-900/10'
            : ''
      }`}
    >
      <td className="px-6 py-4 whitespace-nowrap">
        <input
          type="checkbox"
          checked={isSelected}
          onChange={() => onSelect(product.id)}
          className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
        />
      </td>
      <td className="px-6 py-4">
        <div className="flex items-center">
          {product.images && product.images.length > 0 && product.images[0] ? (
            <img
              src={product.images[0].src}
              alt={product.name}
              className="w-10 h-10 object-cover rounded mr-3"
              loading="lazy"
            />
          ) : (
            <div className="w-10 h-10 bg-gray-200 dark:bg-gray-700 rounded mr-3"></div>
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
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
        {product.sku || 'N/A'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
        {quickEditMode ? (
          <div className="flex items-center space-x-2">
            <input
              type="number"
              step="0.01"
              value={quickEditPrice}
              onChange={(e) => setQuickEditPrice(e.target.value)}
              onKeyPress={handleKeyPress}
              className="w-24 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 rounded text-center"
              disabled={updating}
            />
            <button
              onClick={handleQuickEditSaveClick}
              className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-xs"
              disabled={updating}
            >
              Save
            </button>
            <button
              onClick={handleQuickEditCancel}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-gray-300 text-xs"
            >
              Cancel
            </button>
          </div>
        ) : (
          <button
            onClick={handleQuickEditStart}
            className="text-left hover:text-blue-600 dark:hover:text-blue-400"
          >
            {formatPrice(product.price)}
          </button>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
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
      <td className="px-6 py-4 whitespace-nowrap text-sm space-x-2">
        <Link
          to={`/products/${product.id}`}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
        >
          <Edit className="w-3 h-3" />
          Edit
        </Link>
        <button
          onClick={() => onDuplicate(product)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
        >
          <Copy className="w-3 h-3" />
          Clone
        </button>
        <button
          onClick={() => onDelete(product.id)}
          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
        >
          <Trash2 className="w-3 h-3" />
          Delete
        </button>
      </td>
    </tr>
  );
});

export default ProductTableRow;
