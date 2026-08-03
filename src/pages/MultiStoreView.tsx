import React, { useEffect, useState, useCallback, ChangeEvent } from 'react';
import { Link } from 'react-router-dom';
import { useStoreConfig, useCache, useSettings } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';
import type { Store, Order, Product, OrderStatus } from '../types';

interface StoreMetrics {
  totalOrders: number;
  pendingOrders: number;
  totalProducts: number;
  lowStock: number;
}

interface StoreDataResult {
  store: Store;
  orders: Order[];
  products: Product[];
  metrics: StoreMetrics;
  lowStockProducts: Product[];
  recentOrders: Order[];
  error: string | null;
}

interface CombinedOrder extends Order {
  storeName: string;
  storeId: string;
}

const MultiStoreView: React.FC = (): React.ReactElement => {
  const stores = useStoreConfig((state) => state.stores);
  const setCurrentStore = useStoreConfig((state) => state.setCurrentStore);
  // Use direct cache methods to avoid switching current store
  const getCachedOrders = useCache((state) => state.getCachedOrders);
  const getCachedProducts = useCache((state) => state.getCachedProducts);
  const lowStockThreshold = useSettings((state) => state.lowStockThreshold);

  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>('');
  const [storeData, setStoreData] = useState<StoreDataResult[]>([]);
  const [allOrders, setAllOrders] = useState<CombinedOrder[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const { toasts, showToast, removeToast } = useToast();

  const loadAllStoresData = useCallback(async (): Promise<void> => {
    if (stores.length === 0) {
      setError('No stores configured');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const dataPromises = stores.map(async (store): Promise<StoreDataResult> => {
        try {
          const service = new WooCommerceService(store);

          let orders: Order[] = [];
          let products: Product[] = [];

          // Try to get orders from cache first (using store-specific method)
          try {
            const cachedOrders = await getCachedOrders(store.id) as Order[] | null;
            if (cachedOrders && Array.isArray(cachedOrders)) {
              orders = cachedOrders;
            }
          } catch {
            // Cache read error, will fetch from API
          }

          // If no cached orders, fetch from API
          if (orders.length === 0) {
            const ordersResult = await service.getAllOrders({ per_page: 100, orderby: 'date', order: 'desc' });
            orders = ordersResult.success ? ordersResult.data : [];
            // Note: We don't save to cache here to avoid store switching
            // The individual store pages will handle caching
          }

          // Try to get products from cache first (using store-specific method)
          try {
            const cachedProducts = await getCachedProducts(store.id) as Product[] | null;
            if (cachedProducts && Array.isArray(cachedProducts)) {
              products = cachedProducts;
            }
          } catch {
            // Cache read error, will fetch from API
          }

          // If no cached products, fetch from API
          if (products.length === 0) {
            const productsResult = await service.getAllProducts({ per_page: 100 });
            products = productsResult.success ? productsResult.data : [];
            // Note: We don't save to cache here to avoid store switching
            // The individual store pages will handle caching
          }

          // Calculate metrics
          const pendingOrders = orders.filter(
            (order) => order.status === 'pending' || order.status === 'processing'
          ).length;

          const lowStockProducts = products.filter(
            (p) => p.stock_quantity !== null && p.stock_quantity !== undefined && p.stock_quantity <= lowStockThreshold
          );

          const recentOrders = orders.slice(0, 5); // Get 5 most recent

          return {
            store,
            orders,
            products,
            metrics: {
              totalOrders: orders.length,
              pendingOrders,
              totalProducts: products.length,
              lowStock: lowStockProducts.length,
            },
            lowStockProducts,
            recentOrders,
            error: null,
          };
        } catch (err) {
          const errorMessage = err instanceof Error ? err.message : 'Unknown error';
          return {
            store,
            orders: [],
            products: [],
            metrics: { totalOrders: 0, pendingOrders: 0, totalProducts: 0, lowStock: 0 },
            lowStockProducts: [],
            recentOrders: [],
            error: errorMessage,
          };
        }
      });

      const results = await Promise.all(dataPromises);
      setStoreData(results);

      // Combine all orders from all stores
      const combinedOrders: CombinedOrder[] = results.flatMap((result) =>
        result.orders.map((order) => ({
          ...order,
          storeName: result.store.name,
          storeId: result.store.id,
        }))
      );

      // Sort by date (most recent first)
      combinedOrders.sort((a, b) => new Date(b.date_created).getTime() - new Date(a.date_created).getTime());

      setAllOrders(combinedOrders);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      setError(`Error loading stores data: ${errorMessage}`);
    } finally {
      setLoading(false);
    }
  }, [stores, getCachedOrders, getCachedProducts, lowStockThreshold]);

  useEffect(() => {
    void Promise.resolve().then(loadAllStoresData);
  }, [loadAllStoresData]);

  const aggregateMetrics = (): StoreMetrics => {
    return storeData.reduce(
      (acc, data) => ({
        totalOrders: acc.totalOrders + data.metrics.totalOrders,
        pendingOrders: acc.pendingOrders + data.metrics.pendingOrders,
        totalProducts: acc.totalProducts + data.metrics.totalProducts,
        lowStock: acc.lowStock + data.metrics.lowStock,
      }),
      { totalOrders: 0, pendingOrders: 0, totalProducts: 0, lowStock: 0 }
    );
  };

  const getStatusColor = (status: string): string => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300',
      processing: 'bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300',
      'on-hold': 'bg-orange-100 dark:bg-orange-900/50 text-orange-800 dark:text-orange-300',
      completed: 'bg-green-100 dark:bg-green-900/50 text-green-800 dark:text-green-300',
      cancelled: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
      refunded: 'bg-purple-100 dark:bg-purple-900/50 text-purple-800 dark:text-purple-300',
      failed: 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300',
    };
    return colors[status] || 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300';
  };

  const handleStatusChange = async (order: CombinedOrder, newStatus: string): Promise<void> => {
    try {
      const store = stores.find((s) => s.id === order.storeId);
      if (!store) return;

      const service = new WooCommerceService(store);
      const result = await service.updateOrder(order.id, { status: newStatus as OrderStatus });

      if (result.success) {
        // Update local state
        setAllOrders((prev) =>
          prev.map((o) =>
            o.id === order.id && o.storeId === order.storeId
              ? { ...o, status: newStatus as OrderStatus }
              : o
          )
        );

        // Update storeData
        setStoreData((prev) =>
          prev.map((data) => {
            if (data.store.id === order.storeId) {
              return {
                ...data,
                orders: data.orders.map((o) =>
                  o.id === order.id ? { ...o, status: newStatus as OrderStatus } : o
                ),
              };
            }
            return data;
          })
        );
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      showToast(`Failed to update order status: ${errorMessage}`, 'error');
    }
  };

  const switchToStore = (storeId: string): void => {
    setCurrentStore(storeId);
  };

  const filteredOrders = allOrders.filter((order) => {
    const matchesStatus =
      selectedStatuses.length === 0 || selectedStatuses.includes(order.status);
    const matchesSearch =
      searchTerm === '' ||
      order.id.toString().includes(searchTerm) ||
      `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`
        .toLowerCase()
        .includes(searchTerm.toLowerCase()) ||
      (order.billing?.email || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.storeName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 dark:border-blue-400"></div>
        <p className="mt-4 text-gray-600 dark:text-gray-300 font-medium">Loading data from all stores...</p>
        <p className="mt-2 text-gray-500 dark:text-gray-400 text-sm max-w-md mx-auto">
          Fetching orders, products, and inventory from {stores.length} store{stores.length !== 1 ? 's' : ''}
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-800 dark:text-red-300 px-4 py-3 rounded-md">
        {error}
      </div>
    );
  }

  if (stores.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 dark:text-gray-400 mb-4">No stores configured</p>
        <Link
          to="/setup"
          className="inline-block px-4 py-2 bg-blue-600 dark:bg-blue-500 text-white rounded-md hover:bg-blue-700 dark:hover:bg-blue-600"
        >
          Add Store
        </Link>
      </div>
    );
  }

  const metrics = aggregateMetrics();
  const statuses: string[] = ['pending', 'processing', 'on-hold', 'completed', 'cancelled', 'refunded', 'failed'];

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Multi-Store Dashboard</h2>
        <p className="text-gray-600 dark:text-gray-400 mt-1">
          Unified view across {stores.length} store{stores.length !== 1 ? 's' : ''}
        </p>
      </div>

      {/* Aggregated Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">📦</span>
            <span className="text-3xl font-bold text-blue-600 dark:text-blue-400">{metrics.totalOrders}</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Total Orders</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Across all stores</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⏳</span>
            <span className="text-3xl font-bold text-yellow-600 dark:text-yellow-400">{metrics.pendingOrders}</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Pending Orders</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Needs attention</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">🛍️</span>
            <span className="text-3xl font-bold text-green-600 dark:text-green-400">{metrics.totalProducts}</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Total Products</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Combined catalog</p>
        </div>

        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6">
          <div className="flex items-center justify-between mb-2">
            <span className="text-3xl">⚠️</span>
            <span className="text-3xl font-bold text-red-600 dark:text-red-400">{metrics.lowStock}</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Low Stock Items</h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">Across all stores</p>
        </div>
      </div>

      {/* Store Cards */}
      <div className="mb-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Store Overview</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {storeData.map((data) => (
            <div key={data.store.id} className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4">
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-gray-900 dark:text-white">{data.store.name}</h4>
                <button
                  onClick={() => switchToStore(data.store.id)}
                  className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300"
                  title="Switch to this store"
                >
                  Switch →
                </button>
              </div>

              {data.error ? (
                <p className="text-sm text-red-600 dark:text-red-400">Error: {data.error}</p>
              ) : (
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Orders</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{data.metrics.totalOrders}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Pending</p>
                    <p className="font-semibold text-yellow-600 dark:text-yellow-400">{data.metrics.pendingOrders}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Products</p>
                    <p className="font-semibold text-gray-900 dark:text-white">{data.metrics.totalProducts}</p>
                  </div>
                  <div>
                    <p className="text-gray-500 dark:text-gray-400">Low Stock</p>
                    <p className="font-semibold text-red-600 dark:text-red-400">{data.metrics.lowStock}</p>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Unified Orders List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">All Orders</h3>
            <button
              onClick={loadAllStoresData}
              className="px-4 py-2 text-sm font-medium text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/30 rounded-md hover:bg-blue-100 dark:hover:bg-blue-900/50"
            >
              Refresh All
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by order ID, customer, email, or store..."
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
              />
            </div>

            {/* Status Filter */}
            <div className="flex gap-2 flex-wrap">
              {statuses.map((status) => (
                <button
                  key={status}
                  onClick={() => {
                    setSelectedStatuses((prev) =>
                      prev.includes(status)
                        ? prev.filter((s) => s !== status)
                        : [...prev, status]
                    );
                  }}
                  className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                    selectedStatuses.includes(status)
                      ? 'bg-blue-600 dark:bg-blue-500 text-white'
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Orders Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Order ID
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Store
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Total
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    No orders found
                  </td>
                </tr>
              ) : (
                filteredOrders.slice(0, 50).map((order) => (
                  <tr key={`${order.storeId}-${order.id}`} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      #{order.id}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                        {order.storeName}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                      <div>
                        {order.billing?.first_name || ''} {order.billing?.last_name || ''}
                      </div>
                      <div className="text-gray-500 dark:text-gray-400 text-xs">{order.billing?.email || ''}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {new Date(order.date_created).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                      {order.currency_symbol || '$'}
                      {parseFloat(order.total).toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <select
                        value={order.status}
                        onChange={(e: ChangeEvent<HTMLSelectElement>) => handleStatusChange(order, e.target.value)}
                        className={`px-2 py-1 rounded-full text-xs font-medium border-none cursor-pointer ${getStatusColor(
                          order.status
                        )}`}
                      >
                        {statuses.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <button
                        onClick={() => {
                          switchToStore(order.storeId);
                          // Navigate after store switch
                          setTimeout(() => {
                            window.location.href = `/orders/${order.id}`;
                          }, 100);
                        }}
                        className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredOrders.length > 50 && (
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700 text-sm text-gray-600 dark:text-gray-300 text-center">
            Showing 50 of {filteredOrders.length} orders
          </div>
        )}
      </div>

      {/* Low Stock Alerts */}
      {metrics.lowStock > 0 && (
        <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
          <div className="p-6 border-b border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Low Stock Alerts</h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Products with 5 or fewer items in stock</p>
          </div>
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {storeData.map((data) =>
              data.lowStockProducts.slice(0, 5).map((product) => (
                <div
                  key={`${data.store.id}-${product.id}`}
                  className="px-6 py-4 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {product.images?.[0]?.src && (
                      <img
                        src={product.images[0].src}
                        alt={product.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{product.name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        {data.store.name} • SKU: {product.sku || 'N/A'}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <span
                      className={`px-3 py-1 rounded-full text-sm font-medium ${
                        product.stock_quantity === 0
                          ? 'bg-red-100 dark:bg-red-900/50 text-red-800 dark:text-red-300'
                          : 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-800 dark:text-yellow-300'
                      }`}
                    >
                      {product.stock_quantity === 0
                        ? 'Out of Stock'
                        : `${product.stock_quantity} left`}
                    </span>
                    <button
                      onClick={() => {
                        switchToStore(data.store.id);
                        setTimeout(() => {
                          window.location.href = '/inventory';
                        }, 100);
                      }}
                      className="text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 text-sm"
                    >
                      Manage
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Recent Activity */}
      <div className="mt-8 bg-white dark:bg-gray-800 rounded-lg shadow-md">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Order Activity</h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Latest orders from all stores</p>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {allOrders.slice(0, 10).map((order) => (
            <div
              key={`${order.storeId}-${order.id}`}
              className="px-6 py-4 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-900 dark:text-white">Order #{order.id}</span>
                    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 dark:bg-blue-900/50 text-blue-800 dark:text-blue-300">
                      {order.storeName}
                    </span>
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${getStatusColor(
                        order.status
                      )}`}
                    >
                      {order.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                    {order.billing?.first_name || ''} {order.billing?.last_name || ''} •{' '}
                    {order.currency_symbol || '$'}
                    {parseFloat(order.total).toFixed(2)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Date(order.date_created).toLocaleDateString()}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-gray-500">
                    {new Date(order.date_created).toLocaleTimeString()}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />
    </div>
  );
};

export default MultiStoreView;
