import React, { useState } from 'react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { Store, Trash2, Edit2, Plus, Save, X, Settings, ExternalLink, CheckCircle, Code2, Package } from 'lucide-react';
import type { WooCommerceStore } from '../types';

interface FormData {
  name: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
}

function SetupPage(): React.ReactElement {
  const addStore = useStoreConfig((state) => state.addStore);
  const stores = useStoreConfig((state) => state.stores);
  const removeStore = useStoreConfig((state) => state.removeStore);
  const updateStore = useStoreConfig((state) => state.updateStore);

  const [formData, setFormData] = useState<FormData>({
    name: '',
    url: '',
    consumerKey: '',
    consumerSecret: '',
  });

  const [editingStoreId, setEditingStoreId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState<FormData>({
    name: '',
    url: '',
    consumerKey: '',
    consumerSecret: '',
  });
  const [editPosInfiniteScroll, setEditPosInfiniteScroll] = useState<boolean>(true);
  const [editRetryDelaySeconds, setEditRetryDelaySeconds] = useState<number>(60);
  const [testing, setTesting] = useState<boolean>(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [showAddForm, setShowAddForm] = useState<boolean>(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
    setError('');
    setSuccess('');
  };

  const handleEditChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    setEditFormData({
      ...editFormData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setTesting(true);

    try {
      // Test the connection
      const service = new WooCommerceService(formData as unknown as WooCommerceStore);
      const result = await service.testConnection();

      if (result.success) {
        // Add the store with currency info from WooCommerce settings
        addStore({
          ...formData,
          currency: result.data.settings?.currency,
          currencySymbol: result.data.settings?.currency_symbol,
        });
        setSuccess('Store added successfully!');
        setFormData({
          name: '',
          url: '',
          consumerKey: '',
          consumerSecret: '',
        });
        setShowAddForm(false);

        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(`Connection failed: ${result.error}`);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleDeleteStore = (id: string): void => {
    if (window.confirm('Are you sure you want to remove this store?')) {
      removeStore(id);
    }
  };

  const handleEditStore = (store: WooCommerceStore): void => {
    setEditingStoreId(store.id);
    setEditFormData({
      name: store.name,
      url: store.url,
      consumerKey: store.consumerKey,
      consumerSecret: store.consumerSecret,
    });
    setEditPosInfiniteScroll(store.loadingSettings?.posInfiniteScroll !== false);
    setEditRetryDelaySeconds(store.loadingSettings?.retryDelaySeconds ?? 60);
  };

  const handleSaveEdit = async (storeId: string): Promise<void> => {
    setTesting(true);
    setError('');

    try {
      // Test the connection with updated credentials
      const service = new WooCommerceService(editFormData as unknown as WooCommerceStore);
      const result = await service.testConnection();

      if (result.success) {
        // Get current store to preserve existing loadingSettings
        const currentStore = stores.find((s) => s.id === storeId);
        const currentLoadingSettings = currentStore?.loadingSettings || { batchSize: 50, batchDelay: 500 };

        updateStore(storeId, {
          ...editFormData,
          loadingSettings: {
            ...currentLoadingSettings,
            posInfiniteScroll: editPosInfiniteScroll,
            retryDelaySeconds: editRetryDelaySeconds,
          },
          // Update currency info from WooCommerce settings
          currency: result.data.settings?.currency,
          currencySymbol: result.data.settings?.currency_symbol,
        });
        setEditingStoreId(null);
        setSuccess('Store updated successfully!');
        setTimeout(() => {
          setSuccess('');
        }, 3000);
      } else {
        setError(`Connection failed: ${result.error}`);
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setTesting(false);
    }
  };

  const handleCancelEdit = (): void => {
    setEditingStoreId(null);
    setEditFormData({
      name: '',
      url: '',
      consumerKey: '',
      consumerSecret: '',
    });
  };

  return (
    <div className="space-y-6">
      {/* App Branding Header */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-600 rounded-xl">
              <Package className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">StoreOS</h1>
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Desktop app for managing multiple WooCommerce stores
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <a
              href="https://github.com/OpenWPClub/WooCommerce-Manager"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <Code2 className="w-4 h-4" />
              <span>GitHub</span>
            </a>
          </div>
        </div>
        <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700 flex items-center justify-between text-sm">
          <span className="text-gray-500 dark:text-gray-400">
            Made by{' '}
            <a
              href="https://openwpclub.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 dark:text-blue-400 hover:underline"
            >
              OpenWPClub.com
            </a>
          </span>
          <span className="text-gray-400 dark:text-gray-500">Version 1.0.0</span>
        </div>
      </div>

      {/* Settings Section Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 bg-gray-100 dark:bg-gray-800 rounded-lg">
          <Settings className="w-5 h-5 text-gray-600 dark:text-gray-400" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Settings</h2>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Manage your WooCommerce store connections
          </p>
        </div>
      </div>

      {/* Success/Error Messages */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-400 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {success && (
        <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 text-green-800 dark:text-green-400 px-4 py-3 rounded-lg flex items-center gap-2">
          <CheckCircle className="w-4 h-4" />
          {success}
        </div>
      )}

      {/* Connected Stores Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
          <div>
            <h3 className="text-base font-semibold text-gray-900 dark:text-white">Connected Stores</h3>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              {stores.length === 0
                ? 'No stores connected yet'
                : `${stores.length} store${stores.length !== 1 ? 's' : ''} connected`}
            </p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Store
          </button>
        </div>

        <div className="p-6">
          {stores.length > 0 ? (
            <div className="space-y-3">
              {stores.map((store) => (
                <div
                  key={store.id}
                  className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600 hover:border-gray-300 dark:hover:border-gray-500 transition-colors group"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/40 rounded-lg shrink-0">
                      <Store className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <div className="min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white">{store.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400 truncate">{store.url}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 text-xs font-medium rounded-full">
                      <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span>
                      Connected
                    </span>
                    <div className="flex items-center gap-1 ml-2">
                      <a
                        href={store.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Open store"
                      >
                        <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleEditStore(store)}
                        className="p-2 text-gray-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Edit store"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteStore(store.id)}
                        className="p-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-lg transition-colors"
                        title="Remove store"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="p-3 bg-gray-100 dark:bg-gray-700 rounded-full w-fit mx-auto mb-4">
                <Store className="w-8 h-8 text-gray-400 dark:text-gray-500" />
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-1">No stores connected yet</p>
              <p className="text-sm text-gray-500 dark:text-gray-500">
                Click &quot;Add Store&quot; to connect your first WooCommerce store
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Store Form Card */}
      {(showAddForm || editingStoreId) && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden mb-6">
          <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${editingStoreId ? 'bg-blue-100 dark:bg-blue-900/40' : 'bg-green-100 dark:bg-green-900/40'}`}>
                {editingStoreId ? (
                  <Edit2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                ) : (
                  <Plus className="w-4 h-4 text-green-600 dark:text-green-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingStoreId ? 'Edit Store' : 'Add New Store'}
              </h3>
            </div>
            <button
              onClick={() => {
                setShowAddForm(false);
                setEditingStoreId(null);
                setFormData({ name: '', url: '', consumerKey: '', consumerSecret: '' });
                setEditFormData({ name: '', url: '', consumerKey: '', consumerSecret: '' });
                setError('');
              }}
              className="p-2 text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6">
            {editingStoreId ? (
              // Edit Form
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-store-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Store Name
                    </label>
                    <input
                      id="edit-store-name"
                      type="text"
                      name="name"
                      value={editFormData.name}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-store-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Store URL
                    </label>
                    <input
                      id="edit-store-url"
                      type="url"
                      name="url"
                      value={editFormData.url}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="edit-consumer-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Consumer Key
                    </label>
                    <input
                      id="edit-consumer-key"
                      type="text"
                      name="consumerKey"
                      value={editFormData.consumerKey}
                      onChange={handleEditChange}
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="edit-consumer-secret" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Consumer Secret
                    </label>
                    <input
                      id="edit-consumer-secret"
                      type="password"
                      name="consumerSecret"
                      value={editFormData.consumerSecret}
                      onChange={handleEditChange}
                      placeholder="Enter new secret or leave unchanged"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                </div>

                {/* POS Settings */}
                <div className="pt-4 border-t border-gray-200 dark:border-gray-700 space-y-4">
                  <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300">POS Настройки</h4>

                  {/* Infinite scroll toggle */}
                  {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
                  <label htmlFor="pos-infinite-scroll" className="flex items-center gap-3 cursor-pointer">
                    <div className="relative">
                      <input
                        id="pos-infinite-scroll"
                        type="checkbox"
                        checked={editPosInfiniteScroll}
                        onChange={(e) => setEditPosInfiniteScroll(e.target.checked)}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 dark:bg-gray-600 rounded-full peer peer-checked:bg-blue-600 transition-colors"></div>
                      <div className="absolute left-1 top-1 w-4 h-4 bg-white rounded-full transition-transform peer-checked:translate-x-5"></div>
                    </div>
                    <div>
                      <span className="text-sm font-medium text-gray-900 dark:text-white">Автоматично зареждане</span>
                      <p className="text-xs text-gray-500 dark:text-gray-400">
                        Зарежда още продукти при скрол (infinite scroll)
                      </p>
                    </div>
                  </label>

                  {/* Retry delay setting */}
                  <div>
                    <label htmlFor="retry-delay" className="block text-sm font-medium text-gray-900 dark:text-white mb-1">
                      Изчакване при грешка
                    </label>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
                      Секунди преди повторен опит при неуспешна заявка
                    </p>
                    <div className="flex items-center gap-3">
                      <input
                        id="retry-delay"
                        type="number"
                        min="15"
                        max="300"
                        value={editRetryDelaySeconds}
                        onChange={(e) => setEditRetryDelaySeconds(Math.max(15, Math.min(300, parseInt(e.target.value) || 60)))}
                        className="w-24 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      <span className="text-sm text-gray-500 dark:text-gray-400">секунди</span>
                    </div>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    onClick={() => handleSaveEdit(editingStoreId)}
                    disabled={testing}
                    className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    <Save className="w-4 h-4" />
                    {testing ? 'Saving...' : 'Save Changes'}
                  </button>
                  <button
                    onClick={handleCancelEdit}
                    className="px-5 py-2.5 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 text-sm font-medium rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              // Add Form
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="store-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Store Name
                    </label>
                    <input
                      id="store-name"
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      required
                      placeholder="My Store"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                  <div>
                    <label htmlFor="store-url" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Store URL
                    </label>
                    <input
                      id="store-url"
                      type="url"
                      name="url"
                      value={formData.url}
                      onChange={handleChange}
                      required
                      placeholder="https://yourstore.com"
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label htmlFor="consumer-key" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Consumer Key
                    </label>
                    <input
                      id="consumer-key"
                      type="text"
                      name="consumerKey"
                      value={formData.consumerKey}
                      onChange={handleChange}
                      required
                      placeholder="ck_..."
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                  <div>
                    <label htmlFor="consumer-secret" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                      Consumer Secret
                    </label>
                    <input
                      id="consumer-secret"
                      type="password"
                      name="consumerSecret"
                      value={formData.consumerSecret}
                      onChange={handleChange}
                      required
                      placeholder="cs_..."
                      className="w-full px-4 py-2.5 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-900 text-gray-900 dark:text-white rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
                    />
                  </div>
                </div>
                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={testing}
                    className="w-full sm:w-auto px-6 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                  >
                    {testing ? 'Testing Connection...' : 'Add Store'}
                  </button>
                </div>
              </form>
            )}

            {/* Help Section */}
            {!editingStoreId && (
              <div className="mt-6 pt-5 border-t border-gray-200 dark:border-gray-700">
                <details className="group">
                  <summary className="flex items-center gap-2 text-sm font-medium text-gray-600 dark:text-gray-400 cursor-pointer hover:text-gray-900 dark:hover:text-white">
                    <span>How to get API credentials</span>
                    <span className="text-gray-400 group-open:rotate-180 transition-transform">▾</span>
                  </summary>
                  <ol className="mt-3 list-decimal list-inside space-y-1.5 text-sm text-gray-600 dark:text-gray-400">
                    <li>Go to your WooCommerce admin panel</li>
                    <li>Navigate to <span className="font-medium text-gray-700 dark:text-gray-300">WooCommerce → Settings → Advanced → REST API</span></li>
                    <li>Click <span className="font-medium text-gray-700 dark:text-gray-300">&quot;Add key&quot;</span></li>
                    <li>Give it a description and select <span className="font-medium text-gray-700 dark:text-gray-300">&quot;Read/Write&quot;</span> permissions</li>
                    <li>Copy the Consumer Key and Consumer Secret</li>
                  </ol>
                </details>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default SetupPage;
