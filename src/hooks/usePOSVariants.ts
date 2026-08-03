import { useState, useCallback } from 'react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import type { WooCommerceProduct, ProductVariation } from '../types';

interface UsePOSVariantsResult {
  showVariantPicker: boolean;
  setShowVariantPicker: (show: boolean) => void;
  selectedVariableProduct: WooCommerceProduct | null;
  productVariations: ProductVariation[];
  loadingVariations: boolean;
  handleProductClick: (product: WooCommerceProduct) => Promise<void>;
  handleAddVariation: (variation: ProductVariation) => void;
  getVariationName: (variation: ProductVariation) => string;
  closeVariantPicker: () => void;
}

/**
 * Hook for POS variant picker: loading variations for variable products.
 */
export function usePOSVariants(
  addToCart: (product: WooCommerceProduct) => void
): UsePOSVariantsResult {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();

  const [showVariantPicker, setShowVariantPicker] = useState(false);
  const [selectedVariableProduct, setSelectedVariableProduct] = useState<WooCommerceProduct | null>(null);
  const [productVariations, setProductVariations] = useState<ProductVariation[]>([]);
  const [loadingVariations, setLoadingVariations] = useState(false);

  const getVariationName = (variation: ProductVariation): string => {
    if (variation.attributes && variation.attributes.length > 0) {
      return variation.attributes
        .map((attr) => attr.option || attr.name)
        .join(' / ');
    }
    return `#${variation.id}`;
  };

  const handleProductClick = useCallback(async (product: WooCommerceProduct): Promise<void> => {
    if (product.type === 'variable' && product.variations && product.variations.length > 0) {
      setSelectedVariableProduct(product);
      setShowVariantPicker(true);
      setLoadingVariations(true);

      try {
        if (currentStore) {
          const service = new WooCommerceService(currentStore);
          const result = await service.getProductVariations(product.id);
          if (result.success && result.data) {
            setProductVariations(result.data);
          }
        }
      } catch {
        // Error loading variations - silently handled
      } finally {
        setLoadingVariations(false);
      }
    } else {
      addToCart(product);
    }
  }, [currentStore, addToCart]);

  const handleAddVariation = (variation: ProductVariation): void => {
    const variationProduct = {
      ...(selectedVariableProduct || {}),
      id: variation.id,
      sku: variation.sku,
      price: variation.price,
      regular_price: variation.regular_price,
      sale_price: variation.sale_price,
      stock_status: variation.stock_status,
      stock_quantity: variation.stock_quantity,
      manage_stock: variation.manage_stock,
      name: selectedVariableProduct
        ? `${selectedVariableProduct.name} - ${getVariationName(variation)}`
        : `Variation #${variation.id}`,
      images: variation.image ? [variation.image] : (selectedVariableProduct?.images ?? []),
    } as WooCommerceProduct;
    addToCart(variationProduct);
    setShowVariantPicker(false);
    setSelectedVariableProduct(null);
    setProductVariations([]);
  };

  const closeVariantPicker = (): void => {
    setShowVariantPicker(false);
    setSelectedVariableProduct(null);
    setProductVariations([]);
  };

  return {
    showVariantPicker,
    setShowVariantPicker,
    selectedVariableProduct,
    productVariations,
    loadingVariations,
    handleProductClick,
    handleAddVariation,
    getVariationName,
    closeVariantPicker,
  };
}

export default usePOSVariants;
