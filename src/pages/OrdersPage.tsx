import React, { useState, useMemo, useCallback, ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { RefreshCw, Filter, X } from 'lucide-react';
import { useStoreConfig, useCache, useSettings, useActivityLog } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { formatPrice } from '../utils/currency';
import { formatDate } from '../utils/dateTime';
import { exportToCSV } from '../utils/csvExport';
import { exportTableToPDF } from '../utils/pdfExport';
import ExportMenu from '../components/ExportMenu';
import { searchOrders, applyOrderFilters } from '../utils/searchService';
import Pagination from '../components/Pagination';
import FilterPresetManager from '../components/FilterPresetManager';
import ToastContainer from '../components/ToastContainer';
import LoadingIndicator from '../components/LoadingIndicator';
import BulkActionsBar from '../components/BulkActionsBar';
import { useToast } from '../hooks/useToast';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { useOfflineMutation } from '../hooks/useOfflineMutation';
import OrderTableRow from '../components/OrderTableRow';
import type { Order, OrderStatus, FilterPreset } from '../types';
import { EMPTY_ORDERS } from '../constants';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';

interface OrderFilters {
  status: string;
  dateFrom: string;
  dateTo: string;
  totalMin: string;
  totalMax: string;
  paymentMethod: string;
}

interface OrderStats {
  total: number;
  pending: number;
  processing: number;
  completed: number;
}

function OrdersPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const refreshOrders = useSettings((state) => state.refreshOrders);
  const setCachedData = useCache((state) => state.setCachedData);
  const ordersFromCache = useCache((state) => state.cache.orders?.data || EMPTY_ORDERS);
  const logActivity = useActivityLog((state) => state.logActivity);
  const currentStore = getCurrentStore();
  const { toasts, showToast, removeToast } = useToast();
  const { mutate: offlineMutate } = useOfflineMutation();

  const [orders, setOrders] = useState<Order[]>(ordersFromCache);
  const [loading, setLoading] = useState<boolean>(ordersFromCache.length === 0);

  const { loadingState } = useProgressiveLoading();
  const [error] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
  const [showAdvancedFilters, setShowAdvancedFilters] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);
  const [bulkProcessing, setBulkProcessing] = useState<boolean>(false);

  // Advanced filter state
  const [filters, setFilters] = useState<OrderFilters>({
    status: searchParams.get('status') || 'all',
    dateFrom: '',
    dateTo: '',
    totalMin: '',
    totalMax: '',
    paymentMethod: 'all',
  });

  // Sync orders state with cache (render-time adjustment - refs can't be
  // read/written during render, so track the previous value via useState).
  // See https://react.dev/learn/you-might-not-need-an-effect
  const [prevOrdersFromCache, setPrevOrdersFromCache] = useState(ordersFromCache);
  if (prevOrdersFromCache !== ordersFromCache) {
    setPrevOrdersFromCache(ordersFromCache);
    // Always sync orders with cache
    setOrders(ordersFromCache);

    // Only mark as loaded when we have data
    if (ordersFromCache.length > 0) {
      setLoading(false);
    }
  }

  // Sync searchTerm with URL params when they change
  const [prevSearchParams, setPrevSearchParams] = useState(searchParams);
  if (prevSearchParams !== searchParams) {
    setPrevSearchParams(searchParams);
    setSearchTerm(searchParams.get('search') || '');
  }

  // Reset to page 1 when search term or filter changes
  const [prevPageResetKey, setPrevPageResetKey] = useState({ searchTerm, filters });
  if (
    prevPageResetKey.searchTerm !== searchTerm ||
    prevPageResetKey.filters !== filters
  ) {
    setPrevPageResetKey({ searchTerm, filters });
    setCurrentPage(1);
  }

  const updateOrderStatus = async (orderId: number, newStatus: string): Promise<void> => {
    if (!currentStore) return;

    const oldStatus = orders.find((o) => o.id === orderId)?.status;

    // Optimistic update
    const updatedOrders = orders.map((order) =>
      order.id === orderId ? { ...order, status: newStatus as OrderStatus } : order
    );
    setOrders(updatedOrders);

    await offlineMutate({
      operationType: 'update_order',
      queueData: { id: orderId, status: newStatus },
      storeId: currentStore.id,
      execute: async () => {
        const service = new WooCommerceService(currentStore);
        const result = await service.updateOrder(orderId, { status: newStatus as OrderStatus });
        if (!result.success) throw new Error(result.error);
        return result;
      },
      onSuccess: async () => {
        await setCachedData('orders', updatedOrders);
        logActivity({
          action: 'order_status_changed',
          entityType: 'order',
          entityId: orderId,
          storeId: currentStore?.id ?? null,
          storeName: currentStore?.name,
          changes: { status: { from: oldStatus, to: newStatus } },
        });
      },
      onError: (error) => {
        // Revert optimistic update
        setOrders(orders);
        showToast(`Failed to update order: ${error}`, 'error');
      },
    });
  };

  const handleExportCSV = (): void => {
    if (!currentStore) return;

    const columns = [
      { key: 'id', label: 'Order ID' },
      { key: 'date_created', label: 'Date', format: (val: unknown) => formatDate(val as string) },
      { key: 'billing.first_name', label: 'First Name' },
      { key: 'billing.last_name', label: 'Last Name' },
      { key: 'billing.email', label: 'Email' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total', format: (val: unknown) => formatPrice(val as string) },
      { key: 'payment_method_title', label: 'Payment Method' },
    ];

    const filename = `orders-${currentStore.name}-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(filteredOrders, columns, filename);
  };

  const handleExportPDF = (): void => {
    if (!currentStore) return;

    const columns = [
      { key: 'id', label: 'Order ID' },
      { key: 'date_created', label: 'Date', format: (val: unknown) => formatDate(val as string) },
      { key: 'billing.first_name', label: 'First Name' },
      { key: 'billing.last_name', label: 'Last Name' },
      { key: 'status', label: 'Status' },
      { key: 'total', label: 'Total', format: (val: unknown) => formatPrice(val as string) },
      { key: 'payment_method_title', label: 'Payment' },
    ];

    exportTableToPDF(filteredOrders, columns, {
      title: `Orders - ${currentStore.name}`,
      orientation: 'landscape',
    });
  };

  const handleSelectAll = (e: ChangeEvent<HTMLInputElement>): void => {
    if (e.target.checked) {
      setSelectedOrderIds(paginatedOrders.map((o) => o.id));
    } else {
      setSelectedOrderIds([]);
    }
  };

  // Memoized callback for selecting orders - prevents re-renders of table rows
  const handleSelectOrder = useCallback((orderId: number): void => {
    setSelectedOrderIds((prev) => {
      if (prev.includes(orderId)) {
        return prev.filter((id) => id !== orderId);
      } else {
        return [...prev, orderId];
      }
    });
  }, []);

  // Get selected orders objects
  const selectedOrders = useMemo(() => {
    return orders.filter((order) => selectedOrderIds.includes(order.id));
  }, [orders, selectedOrderIds]);

  const handleBulkStatusUpdate = async (newStatus: OrderStatus): Promise<void> => {
    if (selectedOrderIds.length === 0 || !currentStore) return;

    // Capture previous statuses for undo
    const previousStatuses = selectedOrderIds.map((id) => ({
      id,
      status: orders.find((o) => o.id === id)?.status ?? newStatus,
    }));

    try {
      setBulkProcessing(true);
      const service = new WooCommerceService(currentStore);

      const updatePromises = selectedOrderIds.map((id) =>
        service.updateOrder(id, { status: newStatus })
      );
      await Promise.all(updatePromises);

      const updatedOrders = orders.map((order) =>
        selectedOrderIds.includes(order.id) ? { ...order, status: newStatus } : order
      );
      setOrders(updatedOrders);
      await setCachedData('orders', updatedOrders);
      logActivity({
        action: 'order_status_changed',
        entityType: 'order',
        storeId: currentStore?.id ?? null,
        storeName: currentStore?.name,
        details: `Bulk updated ${selectedOrderIds.length} orders to "${newStatus}"`,
        changes: { status: { from: 'various', to: newStatus } },
      });
      setSelectedOrderIds([]);
      showToast(
        `Успешно обновени ${selectedOrderIds.length} поръчки към "${newStatus}"`,
        'success',
        5000,
        {
          label: 'Отмени',
          onClick: async () => {
            try {
              const undoService = new WooCommerceService(currentStore);
              await Promise.all(
                previousStatuses.map(({ id, status }) =>
                  undoService.updateOrder(id, { status })
                )
              );
              const restoredOrders = updatedOrders.map((order) => {
                const prev = previousStatuses.find((p) => p.id === order.id);
                return prev ? { ...order, status: prev.status } : order;
              });
              setOrders(restoredOrders);
              await setCachedData('orders', restoredOrders);
              showToast('Статусите са възстановени', 'info');
            } catch {
              showToast('Грешка при отмяна', 'error');
            }
          },
        }
      );
    } catch (err) {
      showToast(`Грешка при обновяване: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  const handleBulkExport = useCallback((): void => {
    if (selectedOrders.length === 0) return;

    const exportData = selectedOrders.map((order) => ({
      'Order ID': order.id,
      'Status': order.status,
      'Customer': `${order.billing?.first_name || ''} ${order.billing?.last_name || ''}`.trim(),
      'Email': order.billing?.email || '',
      'Phone': order.billing?.phone || '',
      'Total': order.total,
      'Currency': order.currency,
      'Payment Method': order.payment_method_title || order.payment_method || '',
      'Date': order.date_created,
      'Items': (order.line_items || []).map((item) => `${item.name} x${item.quantity}`).join('; '),
      'Shipping Address': [
        order.shipping?.address_1,
        order.shipping?.city,
        order.shipping?.postcode,
        order.shipping?.country,
      ]
        .filter(Boolean)
        .join(', '),
    }));

    const exportFilename = `orders-export-${new Date().toISOString().split('T')[0]}`;
    const exportColumns = (Object.keys(exportData[0] ?? {}) as (keyof typeof exportData[0])[]).map((k) => ({
      key: k as string,
      label: k as string,
    }));
    exportToCSV(exportData, exportColumns, exportFilename);
    showToast(`Експортирани ${selectedOrders.length} поръчки`, 'success');
  }, [selectedOrders, showToast]);

  const handleBulkDelete = async (): Promise<void> => {
    if (selectedOrderIds.length === 0 || !currentStore) return;

    try {
      setBulkProcessing(true);
      const service = new WooCommerceService(currentStore);

      // Delete orders one by one
      const deletePromises = selectedOrderIds.map((id) => service.deleteOrder(id));

      await Promise.all(deletePromises);

      // Update local state
      const remainingOrders = orders.filter((order) => !selectedOrderIds.includes(order.id));
      setOrders(remainingOrders);
      await setCachedData('orders', remainingOrders);
      logActivity({
        action: 'order_updated',
        entityType: 'order',
        storeId: currentStore?.id ?? null,
        storeName: currentStore?.name,
        details: `Bulk deleted ${selectedOrderIds.length} orders`,
      });

      showToast(`Изтрити ${selectedOrderIds.length} поръчки`, 'success');
      setSelectedOrderIds([]);
    } catch (err) {
      showToast(`Грешка при изтриване: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setBulkProcessing(false);
    }
  };

  // Memoized search results - only recalculates when orders or searchTerm changes.
  // Always returns a fresh array (never the same reference as `orders`) so
  // downstream derived values can't accidentally alias mutable state.
  const searchedOrders = useMemo(() => {
    if (searchTerm.trim() === '') return orders.slice();
    return searchOrders(orders, searchTerm);
  }, [orders, searchTerm]);

  // Memoized filtered results - only recalculates when searchedOrders or filters change.
  // React Compiler (RC) can't currently prove applyOrderFilters (a pure .filter())
  // won't mutate its input through this chain of memoized values; manual useMemo
  // is correct and this only forgoes the extra compiler-level optimization.
  // eslint-disable-next-line react-hooks/preserve-manual-memoization
  const filteredOrders = useMemo(() => {
    return applyOrderFilters(searchedOrders, filters);
  }, [searchedOrders, filters]);

  // Memoized stats - only recalculates when orders change
  const stats = useMemo<OrderStats>(() => {
    const total = orders.length;
    const pending = orders.filter((o) => o.status === 'pending').length;
    const processing = orders.filter((o) => o.status === 'processing').length;
    const completed = orders.filter((o) => o.status === 'completed').length;

    return { total, pending, processing, completed };
  }, [orders]);

  // Memoized check for active filters
  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some((value) => value !== '' && value !== 'all');
  }, [filters]);

  const clearAllFilters = (): void => {
    setFilters({
      status: 'all',
      dateFrom: '',
      dateTo: '',
      totalMin: '',
      totalMax: '',
      paymentMethod: 'all',
    });
    setSearchTerm('');
    setSearchParams({});
  };

  const handleApplyPreset = (presetFilters: Record<string, unknown>): void => {
    setFilters(presetFilters as unknown as OrderFilters);
    showToast('Filter preset applied', 'success');
  };

  // Memoized pagination - only recalculates when filteredOrders, currentPage, or pageSize changes.
  // Same React Compiler limitation as filteredOrders above; .slice() is pure.
  /* eslint-disable react-hooks/preserve-manual-memoization */
  const paginatedOrders = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    const endIndex = startIndex + pageSize;
    return filteredOrders.slice(startIndex, endIndex);
  }, [filteredOrders, currentPage, pageSize]);
  /* eslint-enable react-hooks/preserve-manual-memoization */

  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newPageSize: number): void => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  if (!currentStore) {
    return <EmptyState title="No store selected" message="Please select a store to view orders" />;
  }

  return (
    <div>
      <LoadingIndicator loadingState={loadingState} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader title="Orders" subtitle="Manage your store orders" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Total Orders" value={stats.total} />
        <StatCard label="Pending" value={stats.pending} color="yellow" />
        <StatCard label="Processing" value={stats.processing} color="blue" />
        <StatCard label="Completed" value={stats.completed} color="green" />
      </div>

      {/* Search and Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 transition-colors">
        <div className="flex flex-col gap-4">
          {/* Search Bar and Actions */}
          <div className="flex gap-4">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by order ID, customer name, or email..."
                value={searchTerm}
                onChange={(e: ChangeEvent<HTMLInputElement>) => {
                  const value = e.target.value;
                  setSearchTerm(value);
                  // Update URL params to sync with GlobalSearch
                  if (value.trim() !== '') {
                    setSearchParams({ search: value });
                  } else {
                    setSearchParams({});
                  }
                }}
                className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                hasActiveFilters
                  ? 'bg-blue-600 text-white hover:bg-blue-700'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
              title="Toggle advanced filters"
            >
              <Filter className="w-4 h-4" />
              Filters
              {hasActiveFilters && (
                <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded-full text-xs">
                  Active
                </span>
              )}
            </button>
            <FilterPresetManager
              type="orders"
              currentFilters={filters as unknown as Record<string, unknown>}
              onApplyPreset={handleApplyPreset}
              onSaveSuccess={(preset: FilterPreset) => showToast(`Preset "${preset.name}" saved`, 'success')}
            />
            <ExportMenu onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
            <button
              onClick={() => refreshOrders?.()}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              title="Refresh orders"
            >
              <RefreshCw className={`w-4 h-4 ${loadingState.isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>

          {/* Advanced Filters */}
          {showAdvancedFilters && (
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Advanced Filters
                </h3>
                {(hasActiveFilters || searchTerm) && (
                  <button
                    onClick={clearAllFilters}
                    className="flex items-center gap-1 text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300"
                  >
                    <X className="w-4 h-4" />
                    Clear All
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* Order Status Filter */}
                <div>
                  <label
                    htmlFor="order-status-filter"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Order Status
                  </label>
                  <select
                    id="order-status-filter"
                    value={filters.status}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setFilters({ ...filters, status: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="processing">Processing</option>
                    <option value="on-hold">On Hold</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                    <option value="refunded">Refunded</option>
                    <option value="failed">Failed</option>
                  </select>
                </div>

                {/* Payment Method Filter */}
                <div>
                  <label
                    htmlFor="payment-method-filter"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    Payment Method
                  </label>
                  <select
                    id="payment-method-filter"
                    value={filters.paymentMethod}
                    onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                      setFilters({ ...filters, paymentMethod: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="all">All Methods</option>
                    <option value="bacs">Bank Transfer</option>
                    <option value="cheque">Check</option>
                    <option value="cod">Cash on Delivery</option>
                    <option value="paypal">PayPal</option>
                    <option value="stripe">Stripe</option>
                  </select>
                </div>

                {/* Total Amount Range */}
                <div>
                  <span className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Total Amount
                  </span>
                  <div className="flex gap-2">
                    <input
                      id="total-min"
                      type="number"
                      placeholder="Min"
                      aria-label="Minimum total amount"
                      value={filters.totalMin}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setFilters({ ...filters, totalMin: e.target.value })
                      }
                      className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                    <input
                      id="total-max"
                      type="number"
                      placeholder="Max"
                      aria-label="Maximum total amount"
                      value={filters.totalMax}
                      onChange={(e: ChangeEvent<HTMLInputElement>) =>
                        setFilters({ ...filters, totalMax: e.target.value })
                      }
                      className="w-1/2 px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                    />
                  </div>
                </div>

                {/* Date Range */}
                <div>
                  <label
                    htmlFor="date-from"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    From Date
                  </label>
                  <input
                    id="date-from"
                    type="date"
                    value={filters.dateFrom}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFilters({ ...filters, dateFrom: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor="date-to"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                  >
                    To Date
                  </label>
                  <input
                    id="date-to"
                    type="date"
                    value={filters.dateTo}
                    onChange={(e: ChangeEvent<HTMLInputElement>) =>
                      setFilters({ ...filters, dateTo: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </div>

              {/* Results Summary */}
              <div className="text-sm text-gray-600 dark:text-gray-400">
                Showing{' '}
                <span className="font-semibold text-gray-900 dark:text-white">
                  {filteredOrders.length}
                </span>{' '}
                of{' '}
                <span className="font-semibold text-gray-900 dark:text-white">{orders.length}</span>{' '}
                orders
              </div>
            </div>
          )}
        </div>

        {/* Bulk Actions Bar */}
        {selectedOrderIds.length > 0 && (
          <BulkActionsBar
            selectedCount={selectedOrderIds.length}
            selectedOrders={selectedOrders}
            onStatusChange={handleBulkStatusUpdate}
            onExport={handleBulkExport}
            onDelete={handleBulkDelete}
            onClearSelection={() => setSelectedOrderIds([])}
            isProcessing={bulkProcessing}
          />
        )}
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600">Loading orders...</p>
        </div>
      ) : error ? (
        <div className="bg-red-50 border border-red-200 text-red-800 px-4 py-3 rounded-md">
          {error}
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  <th className="px-3 py-3 text-left w-10">
                    <input
                      type="checkbox"
                      checked={
                        selectedOrderIds.length === paginatedOrders.length &&
                        paginatedOrders.length > 0
                      }
                      onChange={handleSelectAll}
                      className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Order ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedOrders.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No orders found
                    </td>
                  </tr>
                ) : (
                  paginatedOrders.map((order) => (
                    <OrderTableRow
                      key={order.id}
                      order={order}
                      isSelected={selectedOrderIds.includes(order.id)}
                      onSelect={handleSelectOrder}
                      onStatusChange={updateOrderStatus}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
          {filteredOrders.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredOrders.length}
              pageSize={pageSize}
              onPageChange={handlePageChange}
              onPageSizeChange={handlePageSizeChange}
            />
          )}
        </div>
      )}
    </div>
  );
}

export default OrdersPage;
