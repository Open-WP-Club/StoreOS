import { useState, useCallback, useRef, ChangeEvent, RefObject } from 'react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import type { Product, ProductUpdateData, CatalogVisibility, TaxStatus, StockStatus } from '../types';

export type EditorMode = 'visual' | 'code';

export interface ProductFormData {
  name: string;
  description: string;
  short_description: string;
  sku: string;
  regular_price: string;
  sale_price: string;
  manage_stock: boolean;
  stock_quantity: string;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  weight: string;
  length: string;
  width: string;
  height: string;
  shipping_class: string;
  tax_status: 'taxable' | 'shipping' | 'none';
  tax_class: string;
  featured: boolean;
  catalog_visibility: 'visible' | 'catalog' | 'search' | 'hidden';
  virtual: boolean;
  downloadable: boolean;
  purchase_note: string;
  menu_order: number;
  // SEO
  slug: string;
}

const INITIAL_FORM_DATA: ProductFormData = {
  name: '',
  description: '',
  short_description: '',
  sku: '',
  regular_price: '',
  sale_price: '',
  manage_stock: false,
  stock_quantity: '',
  stock_status: 'instock',
  weight: '',
  length: '',
  width: '',
  height: '',
  shipping_class: '',
  tax_status: 'taxable',
  tax_class: '',
  featured: false,
  catalog_visibility: 'visible',
  virtual: false,
  downloadable: false,
  purchase_note: '',
  menu_order: 0,
  slug: '',
};

interface UseProductEditFormResult {
  formData: ProductFormData;
  saving: boolean;
  successMessage: string;
  descriptionMode: EditorMode;
  shortDescriptionMode: EditorMode;
  descriptionRef: RefObject<HTMLDivElement | null>;
  shortDescriptionRef: RefObject<HTMLDivElement | null>;
  populateFormData: (product: Product) => void;
  handleInputChange: (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => void;
  handleVisualEditorBlur: (field: 'description' | 'short_description') => void;
  handleModeSwitch: (field: 'description' | 'short_description', newMode: EditorMode) => void;
  handleSave: (productId: number) => Promise<Product | null>;
}

/**
 * Hook encapsulating form state, input handlers, editor modes, and save logic
 * for the Product Edit page.
 */
export function useProductEditForm(): UseProductEditFormResult {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();

  const [formData, setFormData] = useState<ProductFormData>(INITIAL_FORM_DATA);
  const [saving, setSaving] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const [descriptionMode, setDescriptionMode] = useState<EditorMode>('visual');
  const [shortDescriptionMode, setShortDescriptionMode] = useState<EditorMode>('visual');
  const descriptionRef = useRef<HTMLDivElement>(null);
  const shortDescriptionRef = useRef<HTMLDivElement>(null);

  const populateFormData = useCallback((productData: Product): void => {
    setFormData({
      name: productData.name || '',
      description: productData.description || '',
      short_description: productData.short_description || '',
      sku: productData.sku || '',
      regular_price: productData.regular_price || '',
      sale_price: productData.sale_price || '',
      manage_stock: productData.manage_stock || false,
      stock_quantity: productData.stock_quantity?.toString() || '',
      stock_status: (productData.stock_status as ProductFormData['stock_status']) || 'instock',
      weight: productData.weight || '',
      length: productData.dimensions?.length || '',
      width: productData.dimensions?.width || '',
      height: productData.dimensions?.height || '',
      shipping_class: productData.shipping_class || '',
      tax_status: (productData.tax_status as ProductFormData['tax_status']) || 'taxable',
      tax_class: productData.tax_class || '',
      featured: productData.featured || false,
      catalog_visibility: (productData.catalog_visibility as ProductFormData['catalog_visibility']) || 'visible',
      virtual: productData.virtual || false,
      downloadable: productData.downloadable || false,
      purchase_note: productData.purchase_note || '',
      menu_order: productData.menu_order || 0,
      slug: productData.slug || '',
    });
  }, []);

  const handleInputChange = (
    e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ): void => {
    const target = e.target;
    const name = target.name;
    const value = target.type === 'checkbox' ? (target as HTMLInputElement).checked : target.value;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleVisualEditorBlur = (field: 'description' | 'short_description'): void => {
    const ref = field === 'description' ? descriptionRef : shortDescriptionRef;
    if (ref.current) {
      const content = ref.current.innerHTML;
      setFormData((prev) => ({ ...prev, [field]: content }));
    }
  };

  const handleModeSwitch = (field: 'description' | 'short_description', newMode: EditorMode): void => {
    if (field === 'description') {
      if (newMode === 'code' && descriptionRef.current) {
        setFormData((prev) => ({
          ...prev,
          description: descriptionRef.current?.innerHTML ?? prev.description,
        }));
      }
      setDescriptionMode(newMode);
    } else {
      if (newMode === 'code' && shortDescriptionRef.current) {
        setFormData((prev) => ({
          ...prev,
          short_description: shortDescriptionRef.current?.innerHTML ?? prev.short_description,
        }));
      }
      setShortDescriptionMode(newMode);
    }
  };

  const handleSave = async (productId: number): Promise<Product | null> => {
    if (!currentStore) return null;

    try {
      setSaving(true);
      setSuccessMessage('');

      const service = new WooCommerceService(currentStore);

      const updateData: ProductUpdateData = {
        name: formData.name,
        description: formData.description,
        short_description: formData.short_description,
        sku: formData.sku,
        regular_price: formData.regular_price,
        sale_price: formData.sale_price,
        manage_stock: formData.manage_stock,
        stock_quantity: formData.manage_stock ? parseInt(formData.stock_quantity) || 0 : null,
        stock_status: formData.stock_status as StockStatus,
        weight: formData.weight,
        dimensions: {
          length: formData.length,
          width: formData.width,
          height: formData.height,
        },
        shipping_class: formData.shipping_class,
        tax_status: formData.tax_status as TaxStatus,
        tax_class: formData.tax_class,
        featured: formData.featured,
        catalog_visibility: formData.catalog_visibility as CatalogVisibility,
        virtual: formData.virtual,
        downloadable: formData.downloadable,
        purchase_note: formData.purchase_note,
        slug: formData.slug || undefined,
      };

      const response = await service.updateProduct(productId, updateData);

      if (response.success) {
        setSuccessMessage('Product updated successfully!');
        setTimeout(() => setSuccessMessage(''), 3000);
        return response.data;
      } else {
        throw new Error(response.error || 'Failed to update product');
      }
    } finally {
      setSaving(false);
    }
  };

  return {
    formData,
    saving,
    successMessage,
    descriptionMode,
    shortDescriptionMode,
    descriptionRef,
    shortDescriptionRef,
    populateFormData,
    handleInputChange,
    handleVisualEditorBlur,
    handleModeSwitch,
    handleSave,
  };
}

export default useProductEditForm;
