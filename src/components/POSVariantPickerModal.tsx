import { ReactElement } from 'react';
import { X, Package, Loader2 } from 'lucide-react';
import { formatPrice } from '../utils/currency';
import type { WooCommerceProduct, ProductVariation } from '../types';

interface POSVariantPickerModalProps {
  product: WooCommerceProduct;
  variations: ProductVariation[];
  loading: boolean;
  onSelectVariation: (variation: ProductVariation) => void;
  getVariationName: (variation: ProductVariation) => string;
  onClose: () => void;
}

/**
 * Variant picker modal for the POS product grid — lets the cashier choose a
 * specific variation of a variable product before adding it to the cart.
 */
export function POSVariantPickerModal({
  product,
  variations,
  loading,
  onSelectVariation,
  getVariationName,
  onClose,
}: POSVariantPickerModalProps): ReactElement {
  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50"
      role="presentation"
      onClick={onClose}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
      <div
        className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl w-full max-w-lg max-h-[80vh] overflow-hidden"
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-start gap-3">
            {product.images?.[0]?.src ? (
              <div className="w-16 h-16 rounded-lg flex-shrink-0">
                <img
                  src={product.images[0].src}
                  alt={product.name}
                  className="w-16 h-16 rounded-lg object-cover"
                  onError={(e) => {
                    const target = e.currentTarget;
                    target.style.display = 'none';
                    const placeholder = target.nextElementSibling as HTMLElement | null;
                    if (placeholder) placeholder.style.display = 'flex';
                  }}
                />
                <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 items-center justify-center hidden">
                  <Package className="w-7 h-7 text-gray-400" />
                </div>
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-gray-100 dark:bg-gray-700 flex items-center justify-center flex-shrink-0">
                <Package className="w-7 h-7 text-gray-400" />
              </div>
            )}
            <div className="flex-1">
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {product.name}
              </h3>
              <p className="text-sm text-gray-500 dark:text-gray-400">Избери вариант</p>
            </div>
            <button onClick={onClose} className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded">
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 text-blue-600 animate-spin" />
            </div>
          ) : variations.length === 0 ? (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Няма налични варианти</p>
            </div>
          ) : (
            variations.map((variation: ProductVariation) => {
              const variationPrice = parseFloat(variation.sale_price || variation.price || '0');
              const regularPrice = parseFloat(variation.regular_price || variation.price || '0');
              const onSale = variation.sale_price && parseFloat(variation.sale_price) > 0;
              const inStock = variation.stock_status !== 'outofstock';

              return (
                <button
                  key={variation.id}
                  onClick={() => inStock && onSelectVariation(variation)}
                  disabled={!inStock}
                  className={`w-full flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-700 last:border-b-0 text-left transition-colors ${
                    inStock ? 'hover:bg-gray-50 dark:hover:bg-gray-700' : 'opacity-50 cursor-not-allowed'
                  }`}
                >
                  <div className="w-12 h-12 rounded-lg bg-gray-100 dark:bg-gray-700 overflow-hidden flex-shrink-0">
                    {variation.image?.src ? (
                      <>
                        <img
                          src={variation.image.src}
                          alt={getVariationName(variation)}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            const target = e.currentTarget;
                            target.style.display = 'none';
                            const placeholder = target.nextElementSibling as HTMLElement | null;
                            if (placeholder) placeholder.style.display = 'flex';
                          }}
                        />
                        <div className="w-full h-full items-center justify-center hidden">
                          <Package className="w-5 h-5 text-gray-400" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="w-5 h-5 text-gray-400" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900 dark:text-white truncate">
                      {getVariationName(variation)}
                    </p>
                    {variation.sku && <p className="text-xs text-gray-400">SKU: {variation.sku}</p>}
                    {!inStock && <p className="text-xs text-red-500">Изчерпан</p>}
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-blue-600">{formatPrice(variationPrice)}</p>
                    {onSale && <p className="text-xs text-gray-400 line-through">{formatPrice(regularPrice)}</p>}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

export default POSVariantPickerModal;
