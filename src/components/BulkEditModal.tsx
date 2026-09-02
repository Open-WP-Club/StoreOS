import React, { useState, useMemo, useCallback } from 'react';
import type { WooCommerceProduct, StockStatus, TaxStatus, CatalogVisibility, ProductCategory } from '../types';
import BulkEditPreview from './BulkEditPreview';
import BulkEditForm from './BulkEditForm';

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

  if (showPreview) {
    return (
      <BulkEditPreview
        rows={buildPreviewRows()}
        effectiveProductsCount={effectiveProducts.length}
        changeSalePrice={editFields.changeSalePrice}
        saleDateFrom={editFields.saleDateFrom}
        saleDateTo={editFields.saleDateTo}
        changePrice={editFields.changePrice}
        isSaving={isSaving}
        onClose={onClose}
        onBack={handleBackFromPreview}
        onSave={handleSave}
      />
    );
  }

  return (
    <BulkEditForm
      editFields={editFields}
      onFieldToggle={handleFieldToggle}
      onFieldChange={handleFieldChange}
      filterByCategory={filterByCategory}
      selectedCategoryId={selectedCategoryId}
      availableCategories={availableCategories}
      effectiveProducts={effectiveProducts}
      selectedProducts={selectedProducts}
      allProducts={allProducts}
      onCategoryIdChange={handleCategoryIdChange}
      onSetFilterByCategory={handleSetFilterByCategory}
      onClose={onClose}
      onPreview={handlePreview}
    />
  );
};

export default React.memo(BulkEditModal);
