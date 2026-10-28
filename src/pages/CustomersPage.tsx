import React, {
  useEffect,
  useState,
  useMemo,
  useCallback,
  useDeferredValue,
  ChangeEvent,
} from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useStoreConfig, useCache } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { formatPrice } from '../utils/currency';
import { exportToCSV } from '../utils/csvExport';
import { exportTableToPDF } from '../utils/pdfExport';
import { useVirtualRows } from '../hooks/useVirtualRows';
import ExportMenu from '../components/ExportMenu';
import Pagination from '../components/Pagination';
import ToastContainer from '../components/ToastContainer';
import LoadingIndicator from '../components/LoadingIndicator';
import { useToast } from '../hooks/useToast';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { RefreshCw, Search, Mail, Phone, ShoppingBag, DollarSign, User, X } from 'lucide-react';
import type { Customer, WooCommerceOrder } from '../types';
import { EMPTY_CUSTOMERS } from '../constants';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

interface CustomerStats {
  total: number;
  paying: number;
  newThisMonth: number;
  totalRevenue: number;
}

const NOT_SYNCED = Symbol('not-synced');

function CustomersPage(): React.ReactElement {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const getCachedData = useCache((state) => state.getCachedData);
  const setCachedData = useCache((state) => state.setCachedData);
  const clearCacheForType = useCache((state) => state.clearCacheForType);
  const customersFromCache = useCache((state) => state.cache.customers?.data || EMPTY_CUSTOMERS);
  const currentStore = getCurrentStore();
  const { toasts, showToast, removeToast } = useToast();

  const [customers, setCustomers] = useState<Customer[]>(customersFromCache);
  const [loading, setLoading] = useState<boolean>(customersFromCache.length === 0);
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerOrders, setCustomerOrders] = useState<WooCommerceOrder[]>([]);
  const [loadingOrders, setLoadingOrders] = useState<boolean>(false);

  const { loadingState } = useProgressiveLoading();

  // Load customers from cache or API
  useEffect(() => {
    const loadCustomers = async (): Promise<void> => {
      if (!currentStore) return;

      // First check cache
      const cached = await getCachedData('customers');
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setCustomers(cached as Customer[]);
        setLoading(false);
        return;
      }

      // Load from API
      setLoading(true);
      try {
        const service = new WooCommerceService(currentStore);
        const result = await service.getAllCustomers({ per_page: 50 });

        if (result.success) {
          setCustomers(result.data);
          await setCachedData('customers', result.data);
        } else {
          showToast(result.error || 'Failed to load customers', 'error');
        }
      } catch (err) {
        showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadCustomers();
  }, [currentStore, getCachedData, setCachedData, showToast]);

  // Sync customers state with cache
  const [prevCustomersFromCache, setPrevCustomersFromCache] = useState<
    typeof customersFromCache | typeof NOT_SYNCED
  >(NOT_SYNCED);
  if (prevCustomersFromCache !== customersFromCache) {
    setPrevCustomersFromCache(customersFromCache);
    if (customersFromCache.length > 0) {
      setCustomers(customersFromCache);
      setLoading(false);
    }
  }

  // Memoized stats
  const stats = useMemo<CustomerStats>(() => {
    const total = customers.length;
    const paying = customers.filter((c) => c.is_paying_customer).length;
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const newThisMonth = customers.filter((c) => new Date(c.date_created) >= monthStart).length;
    const totalRevenue = customers.reduce((sum, c) => sum + parseFloat(c.total_spent || '0'), 0);

    return { total, paying, newThisMonth, totalRevenue };
  }, [customers]);

  // Search customers
  const deferredSearch = useDeferredValue(searchTerm);
  const searchedCustomers = useMemo(() => {
    if (deferredSearch.trim() === '') return customers;
    const term = deferredSearch.toLowerCase();
    return customers.filter(
      (c) =>
        c.email?.toLowerCase().includes(term) ||
        c.first_name?.toLowerCase().includes(term) ||
        c.last_name?.toLowerCase().includes(term) ||
        `${c.first_name} ${c.last_name}`.toLowerCase().includes(term) ||
        c.billing?.phone?.includes(term)
    );
  }, [customers, deferredSearch]);

  // Pagination
  const paginatedCustomers = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return searchedCustomers.slice(startIndex, startIndex + pageSize);
  }, [searchedCustomers, currentPage, pageSize]);
  const {
    scrollContainer,
    enabled: virtualized,
    rows: visibleRows,
    padTop,
    padBottom,
  } = useVirtualRows(paginatedCustomers);

  // Reset to page 1 when search changes
  const [prevSearchTerm, setPrevSearchTerm] = useState(searchTerm);
  if (prevSearchTerm !== searchTerm) {
    setPrevSearchTerm(searchTerm);
    setCurrentPage(1);
  }

  const handleRefresh = async (): Promise<void> => {
    if (!currentStore) return;

    setLoading(true);
    try {
      await clearCacheForType('customers');
      const service = new WooCommerceService(currentStore);
      const result = await service.getAllCustomers({ per_page: 50 });

      if (result.success) {
        setCustomers(result.data);
        await setCachedData('customers', result.data);
        showToast('Customers refreshed', 'success');
      } else {
        showToast(result.error || 'Failed to refresh customers', 'error');
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleExportCSV = (): void => {
    if (!currentStore) return;

    const columns = [
      { key: 'id', label: 'Customer ID' },
      { key: 'email', label: 'Email' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'billing.phone', label: 'Phone' },
      { key: 'orders_count', label: 'Orders' },
      {
        key: 'total_spent',
        label: 'Total Spent',
        format: (val: unknown) => formatPrice(val as string),
      },
      { key: 'date_created', label: 'Registered' },
    ];

    const filename = `customers-${currentStore.name}-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(searchedCustomers, columns, filename);
  };

  const handleExportPDF = (): void => {
    if (!currentStore) return;

    const columns = [
      { key: 'id', label: 'ID' },
      { key: 'email', label: 'Email' },
      { key: 'first_name', label: 'First Name' },
      { key: 'last_name', label: 'Last Name' },
      { key: 'orders_count', label: 'Orders' },
      {
        key: 'total_spent',
        label: 'Total Spent',
        format: (val: unknown) => formatPrice(val as string),
      },
    ];

    exportTableToPDF(searchedCustomers, columns, {
      title: `Customers - ${currentStore.name}`,
    }).catch(() => showToast('PDF export failed', 'error'));
  };

  const handleViewCustomer = useCallback(
    async (customer: Customer): Promise<void> => {
      setSelectedCustomer(customer);
      setLoadingOrders(true);

      if (!currentStore) return;

      try {
        const service = new WooCommerceService(currentStore);
        const result = await service.getCustomerOrders(customer.id, {
          per_page: 10,
        });

        if (result.success && result.data) {
          setCustomerOrders(result.data);
        }
      } catch {
        // Silent fail for orders
      } finally {
        setLoadingOrders(false);
      }
    },
    [currentStore]
  );

  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newPageSize: number): void => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  if (!currentStore) {
    return (
      <EmptyState title="No store selected" message="Please select a store to view customers" />
    );
  }

  return (
    <div>
      <LoadingIndicator loadingState={loadingState} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader title="Customers" subtitle="Manage your store customers" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Customers" value={stats.total} icon={User} />
        <StatCard label="Paying Customers" value={stats.paying} color="green" icon={ShoppingBag} />
        <StatCard label="New This Month" value={stats.newThisMonth} color="blue" icon={User} />
        <StatCard
          label="Total Revenue"
          value={formatPrice(stats.totalRevenue.toString())}
          color="purple"
          icon={DollarSign}
        />
      </div>

      {/* Search and Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 transition-colors">
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                setSearchTerm(value);
                if (value.trim() !== '') {
                  setSearchParams({ search: value });
                } else {
                  setSearchParams({});
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <ExportMenu onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            title="Refresh customers"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Results Summary */}
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            {searchedCustomers.length}
          </span>{' '}
          of <span className="font-semibold text-gray-900 dark:text-white">{customers.length}</span>{' '}
          customers
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading customers...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors">
          <div
            ref={scrollContainer}
            className={virtualized ? 'overflow-auto max-h-[70vh]' : 'overflow-x-auto'}
          >
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead
                className={`bg-gray-50 dark:bg-gray-700${virtualized ? ' sticky top-0 z-10' : ''}`}
              >
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Phone
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Orders
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total Spent
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Registered
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {padTop > 0 && (
                  <tr aria-hidden="true" style={{ height: padTop }}>
                    <td colSpan={99} className="p-0" />
                  </tr>
                )}
                {paginatedCustomers.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No customers found
                    </td>
                  </tr>
                ) : (
                  visibleRows.map((customer) => (
                    <tr
                      key={customer.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors cursor-pointer"
                      onClick={() => handleViewCustomer(customer)}
                    >
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          {customer.avatar_url ? (
                            <img
                              src={customer.avatar_url}
                              alt={`${customer.first_name} ${customer.last_name}`}
                              className="w-10 h-10 rounded-full mr-3"
                            />
                          ) : (
                            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 rounded-full mr-3 flex items-center justify-center">
                              <User className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-medium text-gray-900 dark:text-white">
                              {customer.first_name} {customer.last_name}
                            </div>
                            {customer.is_paying_customer && (
                              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">
                                Paying
                              </span>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap">
                        <a
                          href={`mailto:${customer.email}`}
                          className="flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Mail className="w-4 h-4" />
                          {customer.email}
                        </a>
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {customer.billing?.phone ? (
                          <a
                            href={`tel:${customer.billing.phone}`}
                            className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-gray-300"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Phone className="w-4 h-4" />
                            {customer.billing.phone}
                          </a>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-white">
                        {customer.orders_count || 0}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                        {formatPrice(customer.total_spent || '0')}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {new Date(customer.date_created).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-4 whitespace-nowrap text-sm">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/orders?customer=${customer.id}`);
                          }}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                        >
                          <ShoppingBag className="w-3 h-3" />
                          Orders
                        </button>
                      </td>
                    </tr>
                  ))
                )}
                {padBottom > 0 && (
                  <tr aria-hidden="true" style={{ height: padBottom }}>
                    <td colSpan={99} className="p-0" />
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {searchedCustomers.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={searchedCustomers.length}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      )}

      {/* Customer Detail Modal */}
      {selectedCustomer && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  {selectedCustomer.avatar_url ? (
                    <img
                      src={selectedCustomer.avatar_url}
                      alt={`${selectedCustomer.first_name} ${selectedCustomer.last_name}`}
                      className="w-16 h-16 rounded-full"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-blue-100 dark:bg-blue-900 rounded-full flex items-center justify-center">
                      <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
                    </div>
                  )}
                  <div>
                    <h3 className="text-xl font-bold text-gray-900 dark:text-white">
                      {selectedCustomer.first_name} {selectedCustomer.last_name}
                    </h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      Customer #{selectedCustomer.id}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerOrders([]);
                  }}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              {/* Customer Stats */}
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
                    {selectedCustomer.orders_count || 0}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Orders</p>
                </div>
                <div className="bg-green-50 dark:bg-green-900/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-green-600 dark:text-green-400">
                    {formatPrice(selectedCustomer.total_spent || '0')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Total Spent</p>
                </div>
                <div className="bg-purple-50 dark:bg-purple-900/30 rounded-lg p-4 text-center">
                  <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">
                    {selectedCustomer.orders_count &&
                    parseFloat(selectedCustomer.total_spent || '0') > 0
                      ? formatPrice(
                          (
                            parseFloat(selectedCustomer.total_spent || '0') /
                            selectedCustomer.orders_count
                          ).toFixed(2)
                        )
                      : formatPrice('0')}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Avg Order</p>
                </div>
              </div>

              {/* Contact Info */}
              <div className="mb-6">
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                  Contact Information
                </h4>
                <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                  <p className="text-sm flex items-center gap-2">
                    <Mail className="w-4 h-4 text-gray-400" />
                    <a
                      href={`mailto:${selectedCustomer.email}`}
                      className="text-blue-600 dark:text-blue-400 hover:underline"
                    >
                      {selectedCustomer.email}
                    </a>
                  </p>
                  {selectedCustomer.billing?.phone && (
                    <p className="text-sm flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <a
                        href={`tel:${selectedCustomer.billing.phone}`}
                        className="text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        {selectedCustomer.billing.phone}
                      </a>
                    </p>
                  )}
                </div>
              </div>

              {/* Billing Address */}
              {selectedCustomer.billing && (
                <div className="mb-6">
                  <h4 className="font-semibold text-gray-900 dark:text-white mb-3">
                    Billing Address
                  </h4>
                  <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 text-sm text-gray-600 dark:text-gray-300">
                    <p>{selectedCustomer.billing.address_1}</p>
                    {selectedCustomer.billing.address_2 && (
                      <p>{selectedCustomer.billing.address_2}</p>
                    )}
                    <p>
                      {selectedCustomer.billing.city}, {selectedCustomer.billing.state}{' '}
                      {selectedCustomer.billing.postcode}
                    </p>
                    <p>{selectedCustomer.billing.country}</p>
                  </div>
                </div>
              )}

              {/* Recent Orders */}
              <div>
                <h4 className="font-semibold text-gray-900 dark:text-white mb-3">Recent Orders</h4>
                {loadingOrders ? (
                  <div className="text-center py-4">
                    <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
                  </div>
                ) : customerOrders.length > 0 ? (
                  <div className="space-y-2">
                    {customerOrders.map((order) => (
                      <div
                        key={order.id}
                        onClick={() => navigate(`/orders/${order.id}`)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            navigate(`/orders/${order.id}`);
                          }
                        }}
                        role="button"
                        tabIndex={0}
                        className="flex items-center justify-between bg-gray-50 dark:bg-gray-700 rounded-lg p-3 cursor-pointer hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                      >
                        <div>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            Order #{order.id}
                          </span>
                          <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                            {new Date(order.date_created).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              order.status === 'completed'
                                ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                                : order.status === 'processing'
                                  ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                                  : 'bg-gray-100 text-gray-800 dark:bg-gray-600 dark:text-gray-300'
                            }`}
                          >
                            {order.status}
                          </span>
                          <span className="text-sm font-medium text-gray-900 dark:text-white">
                            {formatPrice(order.total)}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-4">
                    No orders found
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-3 mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                <button
                  onClick={() => navigate(`/orders?customer=${selectedCustomer.id}`)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
                >
                  View All Orders
                </button>
                <button
                  onClick={() => {
                    setSelectedCustomer(null);
                    setCustomerOrders([]);
                  }}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default CustomersPage;
