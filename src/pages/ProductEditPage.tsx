import { useState, useEffect, useCallback, ReactElement } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useStoreConfig, useCache } from '../stores';
import WooCommerceService from '../services/woocommerce';
import type { WooCommerceProduct } from '../types';
import { formatPrice } from '../utils/currency';
import { Product, ProductImage } from '../types';
import VariationsTab from '../components/VariationsTab';
import ProductEditGeneralTab from '../components/ProductEditGeneralTab';
import ProductEditInventoryTab from '../components/ProductEditInventoryTab';
import ProductEditShippingTab from '../components/ProductEditShippingTab';
import ProductEditAdvancedTab from '../components/ProductEditAdvancedTab';
import ProductEditSeoTab from '../components/ProductEditSeoTab';
import { useProductEditForm } from '../hooks/useProductEditForm';

type TabId = 'general' | 'inventory' | 'shipping' | 'advanced' | 'seo' | 'variations';

interface Tab {
  id: TabId;
  label: string;
}

const TABS: Tab[] = [
  { id: 'general', label: 'General' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'advanced', label: 'Advanced' },
  { id: 'seo', label: 'SEO' },
];

const NOT_SYNCED = Symbol('not-synced');

export default function ProductEditPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const productsFromCache = useCache((state) => state.cache.products?.data as WooCommerceProduct[] | undefined);
  const currentStore = getCurrentStore();

  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabId>('general');

  const form = useProductEditForm();

  // Try to find product in cache first
  const getProductFromCache = useCallback((): Product | null => {
    if (!productsFromCache || !id) return null;
    const productId = parseInt(id);
    return (productsFromCache.find((p) => p.id === productId) as Product) || null;
  }, [productsFromCache, id]);

  // Fetch fresh product data from API
  const fetchProductFromApi = useCallback(async (showLoadingState: boolean = true): Promise<void> => {
    if (!currentStore || !id) return;

    try {
      if (showLoadingState) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }
      setError(null);

      const service = new WooCommerceService(currentStore);
      const response = await service.getProduct(parseInt(id));

      if (response.success) {
        setProduct(response.data);
        form.populateFormData(response.data);
      } else {
        if (!product) {
          setError(response.error || 'Failed to load product');
        }
      }
    } catch (err) {
      if (!product) {
        setError((err as Error).message || 'Failed to load product');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentStore, id, product, form]);

  useEffect(() => {
    if (!currentStore) {
      navigate('/setup');
    }
  }, [currentStore, navigate]);

  const [prevSyncKey, setPrevSyncKey] = useState<typeof NOT_SYNCED | { id: string | undefined; storeId: string | undefined }>(NOT_SYNCED);
  const syncKey = { id, storeId: currentStore?.id };
  if (
    currentStore &&
    (prevSyncKey === NOT_SYNCED || prevSyncKey.id !== syncKey.id || prevSyncKey.storeId !== syncKey.storeId)
  ) {
    setPrevSyncKey(syncKey);

    const cachedProduct = getProductFromCache();

    if (cachedProduct) {
      setProduct(cachedProduct);
      form.populateFormData(cachedProduct);
      setLoading(false);
      fetchProductFromApi(false);
    } else {
      fetchProductFromApi(true);
    }
  }

  const handleSave = async (): Promise<void> => {
    try {
      setError(null);
      const updated = await form.handleSave(parseInt(id!));
      if (updated) {
        setProduct(updated);
      }
    } catch (err) {
      setError((err as Error).message || 'Failed to update product');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading product...</p>
        </div>
      </div>
    );
  }

  if (error && !product) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-300">{error}</p>
          <button
            onClick={() => navigate('/products')}
            className="mt-4 text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300"
          >
            Back to Products
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => navigate('/products')}
              className="text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200"
            >
              ← Back to Products
            </button>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Edit Product</h1>
              {refreshing && (
                <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                  <span className="animate-spin h-3 w-3 border-2 border-blue-500 dark:border-blue-400 border-t-transparent rounded-full"></span>
                  Syncing...
                </span>
              )}
            </div>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleSave}
              disabled={form.saving}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center space-x-2"
            >
              {form.saving && (
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
              )}
              <span>{form.saving ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </div>

        {/* Success/Error Messages */}
        {form.successMessage && (
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4 mb-4">
            <p className="text-green-800 dark:text-green-300">{form.successMessage}</p>
          </div>
        )}
        {error && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 mb-4">
            <p className="text-red-800 dark:text-red-300">{error}</p>
          </div>
        )}

        {/* Product Info Bar */}
        {product && (
          <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-center space-x-6">
              {product.images?.[0]?.src && (
                <img
                  src={product.images[0].src}
                  alt={product.name}
                  className="w-20 h-20 object-cover rounded-lg"
                />
              )}
              <div className="flex-1">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">{product.name}</h2>
                <div className="flex items-center space-x-4 mt-1 text-sm text-gray-600 dark:text-gray-400">
                  <span>ID: {product.id}</span>
                  {product.sku && <span>SKU: {product.sku}</span>}
                  <span className="capitalize">Status: {product.status}</span>
                  <span>Price: {formatPrice(product.price)}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 dark:border-gray-700 mb-6">
        <nav className="flex space-x-8">
          {[...TABS, ...(product?.type === 'variable' ? [{ id: 'variations' as TabId, label: 'Variations' }] : [])].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm transition-colors ${
                activeTab === tab.id
                  ? 'border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400'
                  : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
        {activeTab === 'general' && (
          <ProductEditGeneralTab
            formData={form.formData}
            descriptionMode={form.descriptionMode}
            shortDescriptionMode={form.shortDescriptionMode}
            descriptionRef={form.descriptionRef}
            shortDescriptionRef={form.shortDescriptionRef}
            onInputChange={form.handleInputChange}
            onVisualEditorBlur={form.handleVisualEditorBlur}
            onModeSwitch={form.handleModeSwitch}
          />
        )}

        {activeTab === 'inventory' && (
          <ProductEditInventoryTab
            formData={form.formData}
            onInputChange={form.handleInputChange}
          />
        )}

        {activeTab === 'shipping' && (
          <ProductEditShippingTab
            formData={form.formData}
            onInputChange={form.handleInputChange}
          />
        )}

        {activeTab === 'advanced' && (
          <ProductEditAdvancedTab
            formData={form.formData}
            onInputChange={form.handleInputChange}
          />
        )}

        {activeTab === 'seo' && (
          <ProductEditSeoTab
            formData={form.formData}
            storeUrl={currentStore?.url}
            onInputChange={form.handleInputChange}
          />
        )}
      </div>

      {/* Product Images Section */}
      {product?.images && product.images.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Product Images</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {product.images.map((image: ProductImage, index: number) => (
              <div key={index} className="relative">
                <img
                  src={image.src}
                  alt={image.alt || `Product image ${index + 1}`}
                  className="w-full h-32 object-cover rounded-lg border border-gray-200 dark:border-gray-600"
                />
                {index === 0 && (
                  <span className="absolute top-2 left-2 bg-blue-600 text-white text-xs px-2 py-1 rounded">
                    Main
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Variations Tab (variable products only) */}
      {activeTab === 'variations' && product?.type === 'variable' && currentStore && (
        <VariationsTab product={product} storeConfig={currentStore} />
      )}
    </div>
  );
}
