import React, { useEffect, useState, useMemo, useCallback, ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStoreConfig, useCache, useActivityLog } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { formatPrice } from '../utils/currency';
import { exportToCSV } from '../utils/csvExport';
import { exportTableToPDF } from '../utils/pdfExport';
import ExportMenu from '../components/ExportMenu';
import Pagination from '../components/Pagination';
import ToastContainer from '../components/ToastContainer';
import LoadingIndicator from '../components/LoadingIndicator';
import CouponFormModal from '../components/CouponFormModal';
import { useToast } from '../hooks/useToast';
import { useOfflineMutation } from '../hooks/useOfflineMutation';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import { useCouponForm } from '../hooks/useCouponForm';
import {
  RefreshCw,
  Search,
  Plus,
  Edit,
  Trash2,
  Copy,
  Tag,
  Percent,
  DollarSign,
  Calendar,
  Check,
  Zap,
  TrendingUp,
  Award,
  BarChart3,
  CheckCircle,
} from 'lucide-react';
import type { Coupon, CouponDiscountType } from '../types';
import { EMPTY_COUPONS } from '../constants';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import BulkGenerateCouponsModal from '../components/BulkGenerateCouponsModal';

interface CouponStats {
  total: number;
  active: number;
  expired: number;
  totalUsage: number;
  totalDiscountGiven: number;
  mostUsedCoupon: string;
  avgUsesPerCoupon: number;
  fullyUsed: number;
}

function CouponsPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const getCachedData = useCache((state) => state.getCachedData);
  const setCachedData = useCache((state) => state.setCachedData);
  const clearCacheForType = useCache((state) => state.clearCacheForType);
  const couponsFromCache = useCache((state) => state.cache.coupons?.data || EMPTY_COUPONS);
  const logActivity = useActivityLog((state) => state.logActivity);
  const currentStore = getCurrentStore();
  const toast = useToast();
  const { mutate: offlineMutate } = useOfflineMutation();

  const [coupons, setCoupons] = useState<Coupon[]>(couponsFromCache);
  const [loading, setLoading] = useState<boolean>(couponsFromCache.length === 0);
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [showCreateModal, setShowCreateModal] = useState<boolean>(false);
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'expired'>('all');
  const [filterDiscountType, setFilterDiscountType] = useState<'all' | CouponDiscountType>('all');
  const [showBulkModal, setShowBulkModal] = useState<boolean>(false);

  const { loadingState } = useProgressiveLoading();

  const handleCloseModal = useCallback(() => {
    setShowCreateModal(false);
  }, []);

  const form = useCouponForm({
    currentStore,
    coupons,
    onSuccess: async (updatedCoupons) => {
      setCoupons(updatedCoupons);
      await setCachedData('coupons', updatedCoupons);
    },
    onClose: handleCloseModal,
    toast,
    logActivity,
  });

  // Load coupons from cache or API
  useEffect(() => {
    const loadCoupons = async (): Promise<void> => {
      if (!currentStore) return;

      const cached = await getCachedData('coupons');
      if (cached && Array.isArray(cached) && cached.length > 0) {
        setCoupons(cached as Coupon[]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const service = new WooCommerceService(currentStore);
        const result = await service.getAllCoupons({ per_page: 50 });
        if (result.success) {
          setCoupons(result.data);
          await setCachedData('coupons', result.data);
        } else {
          toast.showToast(result.error || 'Failed to load coupons', 'error');
        }
      } catch (err) {
        toast.showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadCoupons();
  }, [currentStore, getCachedData, setCachedData, toast]);

  // Sync with cache
  const [prevCouponsFromCache, setPrevCouponsFromCache] = useState(couponsFromCache);
  if (prevCouponsFromCache !== couponsFromCache) {
    setPrevCouponsFromCache(couponsFromCache);
    if (couponsFromCache.length > 0) {
      setCoupons(couponsFromCache);
      setLoading(false);
    }
  }

  const isExpired = useCallback(
    (coupon: Coupon): boolean =>
      !!coupon.date_expires && new Date(coupon.date_expires) < new Date(),
    []
  );

  const stats = useMemo<CouponStats>(() => {
    const total = coupons.length;
    const active = coupons.filter((c) => !isExpired(c)).length;
    const expired = coupons.filter((c) => isExpired(c)).length;
    const totalUsage = coupons.reduce((sum, c) => sum + c.usage_count, 0);
    const totalDiscountGiven = coupons.reduce(
      (sum, c) => sum + parseFloat(c.amount || '0') * c.usage_count,
      0
    );
    const mostUsed = coupons.reduce(
      (best, c) => (c.usage_count > (best?.usage_count ?? 0) ? c : best),
      coupons[0] as Coupon | undefined
    );
    return {
      total,
      active,
      expired,
      totalUsage,
      totalDiscountGiven,
      mostUsedCoupon: mostUsed ? mostUsed.code : '-',
      avgUsesPerCoupon: total > 0 ? Math.round((totalUsage / total) * 10) / 10 : 0,
      fullyUsed: coupons.filter(
        (c) => c.usage_limit !== null && c.usage_limit > 0 && c.usage_count >= c.usage_limit
      ).length,
    };
  }, [coupons, isExpired]);

  const filteredCoupons = useMemo(() => {
    let result = coupons;
    if (filterStatus === 'active') result = result.filter((c) => !isExpired(c));
    else if (filterStatus === 'expired') result = result.filter((c) => isExpired(c));
    if (filterDiscountType !== 'all')
      result = result.filter((c) => c.discount_type === filterDiscountType);
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (c) => c.code?.toLowerCase().includes(term) || c.description?.toLowerCase().includes(term)
      );
    }
    return result;
  }, [coupons, searchTerm, filterStatus, filterDiscountType, isExpired]);

  const paginatedCoupons = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredCoupons.slice(start, start + pageSize);
  }, [filteredCoupons, currentPage, pageSize]);

  const [prevFilters, setPrevFilters] = useState({
    searchTerm,
    filterStatus,
    filterDiscountType,
  });
  if (
    prevFilters.searchTerm !== searchTerm ||
    prevFilters.filterStatus !== filterStatus ||
    prevFilters.filterDiscountType !== filterDiscountType
  ) {
    setPrevFilters({ searchTerm, filterStatus, filterDiscountType });
    setCurrentPage(1);
  }

  const handleRefresh = useCallback(async (): Promise<void> => {
    if (!currentStore) return;
    setLoading(true);
    try {
      await clearCacheForType('coupons');
      const service = new WooCommerceService(currentStore);
      const result = await service.getAllCoupons({ per_page: 50 });
      if (result.success) {
        setCoupons(result.data);
        await setCachedData('coupons', result.data);
        toast.showToast('Coupons refreshed', 'success');
      } else {
        toast.showToast(result.error || 'Failed to refresh coupons', 'error');
      }
    } catch (err) {
      toast.showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  }, [currentStore, clearCacheForType, setCachedData, toast]);

  const handleExportCSV = useCallback((): void => {
    if (!currentStore) return;
    exportToCSV(
      filteredCoupons,
      [
        { key: 'id', label: 'Coupon ID' },
        { key: 'code', label: 'Code' },
        { key: 'discount_type', label: 'Type' },
        { key: 'amount', label: 'Amount' },
        { key: 'usage_count', label: 'Uses' },
        { key: 'usage_limit', label: 'Limit' },
        { key: 'date_expires', label: 'Expires' },
        { key: 'description', label: 'Description' },
      ],
      `coupons-${currentStore.name}-${new Date().toISOString().split('T')[0]}.csv`
    );
  }, [currentStore, filteredCoupons]);

  const handleExportPDF = useCallback((): void => {
    if (!currentStore) return;
    exportTableToPDF(
      filteredCoupons,
      [
        { key: 'code', label: 'Code' },
        { key: 'discount_type', label: 'Type' },
        { key: 'amount', label: 'Amount' },
        { key: 'usage_count', label: 'Uses' },
        { key: 'usage_limit', label: 'Limit' },
        { key: 'date_expires', label: 'Expires' },
      ],
      { title: `Coupons - ${currentStore.name}` }
    ).catch(() => toast.showToast('PDF export failed', 'error'));
  }, [currentStore, filteredCoupons, toast]);

  const handleCreateCoupon = useCallback((): void => {
    form.initForCreate();
    setShowCreateModal(true);
  }, [form]);

  const handleEditCoupon = useCallback(
    (coupon: Coupon): void => {
      form.initForEdit(coupon);
      setShowCreateModal(true);
    },
    [form]
  );

  const handleDuplicateCoupon = useCallback(
    async (coupon: Coupon): Promise<void> => {
      if (!currentStore) return;
      const newCode = `${coupon.code}-copy-${Date.now().toString(36)}`;
      const couponData = {
        code: newCode,
        discount_type: coupon.discount_type,
        amount: coupon.amount,
        description: coupon.description,
        individual_use: coupon.individual_use,
        free_shipping: coupon.free_shipping,
        minimum_amount: coupon.minimum_amount,
        maximum_amount: coupon.maximum_amount,
        exclude_sale_items: coupon.exclude_sale_items,
      };

      await offlineMutate({
        operationType: 'create_coupon',
        queueData: couponData as Record<string, unknown>,
        storeId: currentStore.id,
        execute: async () => {
          const service = new WooCommerceService(currentStore);
          const result = await service.createCoupon(couponData);
          if (!result.success) throw new Error(result.error);
          return result;
        },
        onSuccess: async (result) => {
          const updated = [result.data, ...coupons];
          setCoupons(updated);
          await setCachedData('coupons', updated);
          logActivity({
            action: 'coupon_created',
            entityType: 'coupon',
            entityId: result.data.id,
            entityName: result.data.code,
            storeId: currentStore.id ?? null,
            storeName: currentStore.name,
            details: `Duplicated from "${coupon.code}"`,
          });
          toast.showToast('Coupon duplicated successfully', 'success');
        },
        onError: (error) => toast.showToast(`Failed to duplicate coupon: ${error}`, 'error'),
      });
    },
    [currentStore, coupons, setCachedData, logActivity, toast, offlineMutate]
  );

  const handleDeleteCoupon = useCallback(
    async (couponId: number): Promise<void> => {
      if (!window.confirm('Are you sure you want to delete this coupon?') || !currentStore) return;
      const deleted = coupons.find((c) => c.id === couponId);

      await offlineMutate({
        operationType: 'delete_coupon',
        queueData: { id: couponId },
        storeId: currentStore.id,
        execute: async () => {
          const service = new WooCommerceService(currentStore);
          const result = await service.deleteCoupon(couponId);
          if (!result.success) throw new Error(result.error);
          return result;
        },
        onSuccess: async () => {
          const updated = coupons.filter((c) => c.id !== couponId);
          setCoupons(updated);
          await setCachedData('coupons', updated);
          logActivity({
            action: 'coupon_deleted',
            entityType: 'coupon',
            entityId: couponId,
            entityName: deleted?.code,
            storeId: currentStore.id ?? null,
            storeName: currentStore.name,
          });
          toast.showToast('Coupon deleted successfully', 'success');
        },
        onError: (error) => toast.showToast(`Failed to delete coupon: ${error}`, 'error'),
      });
    },
    [currentStore, coupons, setCachedData, logActivity, toast, offlineMutate]
  );

  const getDiscountDisplay = useCallback((coupon: Coupon): string => {
    switch (coupon.discount_type) {
      case 'percent':
        return `${coupon.amount}%`;
      case 'fixed_cart':
      case 'fixed_product':
        return formatPrice(coupon.amount);
      default:
        return coupon.amount;
    }
  }, []);

  if (!currentStore) {
    return <EmptyState title="No store selected" message="Please select a store to view coupons" />;
  }

  return (
    <div>
      <LoadingIndicator loadingState={loadingState} />
      <ToastContainer toasts={toast.toasts} removeToast={toast.removeToast} />

      <PageHeader title="Coupons" subtitle="Manage your discount codes" />

      {/* Stats Row 1 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total Coupons" value={stats.total} icon={Tag} />
        <StatCard label="Active" value={stats.active} color="green" icon={Check} />
        <StatCard label="Expired" value={stats.expired} color="red" icon={Calendar} />
        <StatCard label="Total Uses" value={stats.totalUsage} color="blue" icon={Percent} />
      </div>

      {/* Stats Row 2 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard
          label="Total Discount Given"
          value={`~${formatPrice(stats.totalDiscountGiven.toString())}`}
          color="purple"
          icon={TrendingUp}
        />
        <StatCard
          label="Most Used Coupon"
          value={stats.mostUsedCoupon}
          color="yellow"
          icon={Award}
        />
        <StatCard
          label="Avg Uses / Coupon"
          value={stats.avgUsesPerCoupon}
          color="blue"
          icon={BarChart3}
        />
        <StatCard label="Fully Used" value={stats.fullyUsed} color="green" icon={CheckCircle} />
      </div>

      {/* Search and Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 transition-colors">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by code or description..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                setSearchTerm(value);
                if (value.trim()) setSearchParams({ search: value });
                else setSearchParams({});
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'expired')}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="expired">Expired</option>
          </select>
          <select
            value={filterDiscountType}
            onChange={(e) => setFilterDiscountType(e.target.value as 'all' | CouponDiscountType)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Types</option>
            <option value="percent">Percentage</option>
            <option value="fixed_cart">Fixed Cart</option>
            <option value="fixed_product">Fixed Product</option>
          </select>
          <button
            onClick={handleCreateCoupon}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Create Coupon
          </button>
          <button
            onClick={() => setShowBulkModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors"
          >
            <Zap className="w-4 h-4" />
            Bulk Generate
          </button>
          <ExportMenu onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          <button
            onClick={handleRefresh}
            disabled={loading}
            aria-label="Refresh coupons"
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            {filteredCoupons.length}
          </span>{' '}
          of <span className="font-semibold text-gray-900 dark:text-white">{coupons.length}</span>{' '}
          coupons
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading coupons...</p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
              <thead className="bg-gray-50 dark:bg-gray-700">
                <tr>
                  {['Code', 'Type', 'Amount', 'Usage', 'Expires', 'Status', 'Actions'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                {paginatedCoupons.length === 0 ? (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-6 py-8 text-center text-gray-500 dark:text-gray-400"
                    >
                      No coupons found
                    </td>
                  </tr>
                ) : (
                  paginatedCoupons.map((coupon) => {
                    const expired = isExpired(coupon);
                    return (
                      <tr
                        key={coupon.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors ${expired ? 'opacity-60' : ''}`}
                      >
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2">
                            <Tag className="w-4 h-4 text-gray-400" />
                            <span className="font-mono text-sm font-bold text-gray-900 dark:text-white">
                              {coupon.code}
                            </span>
                          </div>
                          {coupon.description && (
                            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1 truncate max-w-xs">
                              {coupon.description}
                            </p>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span className="flex items-center gap-1 text-sm text-gray-600 dark:text-gray-300">
                            {coupon.discount_type === 'percent' ? (
                              <Percent className="w-4 h-4" />
                            ) : (
                              <DollarSign className="w-4 h-4" />
                            )}
                            {coupon.discount_type.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-white">
                          {getDiscountDisplay(coupon)}
                          {coupon.free_shipping && (
                            <span className="ml-2 text-xs text-green-600 dark:text-green-400">
                              + Free shipping
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {coupon.usage_count}
                          {coupon.usage_limit && ` / ${coupon.usage_limit}`}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                          {coupon.date_expires
                            ? new Date(coupon.date_expires).toLocaleDateString()
                            : 'Never'}
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap">
                          <span
                            className={`px-2 py-1 text-xs font-semibold rounded-full ${
                              expired
                                ? 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
                                : 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
                            }`}
                          >
                            {expired ? 'Expired' : 'Active'}
                          </span>
                        </td>
                        <td className="px-4 py-4 whitespace-nowrap text-sm space-x-1">
                          <button
                            onClick={() => handleEditCoupon(coupon)}
                            aria-label="Edit coupon"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 transition-colors"
                          >
                            <Edit className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDuplicateCoupon(coupon)}
                            aria-label="Duplicate coupon"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-green-600 text-white text-xs rounded hover:bg-green-700 transition-colors"
                          >
                            <Copy className="w-3 h-3" />
                          </button>
                          <button
                            onClick={() => handleDeleteCoupon(coupon.id)}
                            aria-label="Delete coupon"
                            className="inline-flex items-center gap-1 px-2 py-1 bg-red-600 text-white text-xs rounded hover:bg-red-700 transition-colors"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          {filteredCoupons.length > 0 && (
            <Pagination
              currentPage={currentPage}
              totalItems={filteredCoupons.length}
              pageSize={pageSize}
              onPageChange={(page) => {
                setCurrentPage(page);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
            />
          )}
        </div>
      )}

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <CouponFormModal
          editingCoupon={form.editingCoupon}
          formData={form.formData}
          formErrors={form.formErrors}
          saving={form.saving}
          onUpdate={form.updateFormData}
          onBlur={form.handleFieldBlur}
          onGenerate={form.generateCouponCode}
          onSave={form.handleSaveCoupon}
          onClose={() => {
            form.reset();
            setShowCreateModal(false);
          }}
        />
      )}

      {/* Bulk Generate Modal */}
      {showBulkModal && currentStore && (
        <BulkGenerateCouponsModal
          service={new WooCommerceService(currentStore)}
          onClose={() => setShowBulkModal(false)}
          onGenerated={async (newCoupons) => {
            const updated = [...newCoupons, ...coupons];
            setCoupons(updated);
            await setCachedData('coupons', updated);
            toast.showToast(`${newCoupons.length} coupons generated successfully`, 'success');
          }}
        />
      )}
    </div>
  );
}

export default CouponsPage;
