import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import LoadingIndicator from '../components/LoadingIndicator';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';
import StatCard from '../components/StatCard';
import {
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Receipt,
  Globe,
  Percent,
  Tag,
} from 'lucide-react';
import type {
  WooCommerceTaxRate,
  WooCommerceTaxClass,
  TaxRateUpdateData,
} from '../types';

interface TaxRateFormData {
  country: string;
  state: string;
  postcode: string;
  city: string;
  rate: string;
  name: string;
  priority: number;
  compound: boolean;
  shipping: boolean;
  class: string;
}

const defaultRateForm: TaxRateFormData = {
  country: '',
  state: '',
  postcode: '',
  city: '',
  rate: '',
  name: '',
  priority: 1,
  compound: false,
  shipping: true,
  class: 'standard',
};

function TaxPage(): React.ReactElement {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();
  const { toasts, showToast, removeToast } = useToast();

  const [taxRates, setTaxRates] = useState<WooCommerceTaxRate[]>([]);
  const [taxClasses, setTaxClasses] = useState<WooCommerceTaxClass[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'rates' | 'classes'>('rates');
  const [filterClass, setFilterClass] = useState('all');

  // Rate form
  const [showRateForm, setShowRateForm] = useState(false);
  const [editingRateId, setEditingRateId] = useState<number | null>(null);
  const [rateForm, setRateForm] = useState<TaxRateFormData>(defaultRateForm);

  // Class form
  const [showClassForm, setShowClassForm] = useState(false);
  const [newClassName, setNewClassName] = useState('');

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'rate' | 'class';
    id: number | null;
    slug: string | null;
  }>({ isOpen: false, type: 'rate', id: null, slug: null });
  const [deleting, setDeleting] = useState(false);

  const service = useMemo(
    () => (currentStore ? new WooCommerceService(currentStore) : null),
    [currentStore]
  );

  const loadData = useCallback(async () => {
    if (!service) return;
    setLoading(true);

    const [ratesResult, classesResult] = await Promise.all([
      service.getTaxRates({ per_page: 100 }),
      service.getTaxClasses(),
    ]);

    if (ratesResult.success) {
      setTaxRates(ratesResult.data);
    } else {
      showToast(ratesResult.error || 'Failed to load tax rates', 'error');
    }

    if (classesResult.success) {
      setTaxClasses(classesResult.data);
    } else {
      showToast(classesResult.error || 'Failed to load tax classes', 'error');
    }

    setLoading(false);
  }, [service, showToast]);

  useEffect(() => {
    void Promise.resolve().then(loadData);
  }, [loadData]);

  const filteredRates = useMemo(() => {
    if (filterClass === 'all') return taxRates;
    return taxRates.filter((r) => (r.class || 'standard') === filterClass);
  }, [taxRates, filterClass]);

  // Rate CRUD
  const handleCreateRate = () => {
    setEditingRateId(null);
    setRateForm(defaultRateForm);
    setShowRateForm(true);
  };

  const handleEditRate = (rate: WooCommerceTaxRate) => {
    setEditingRateId(rate.id);
    setRateForm({
      country: rate.country,
      state: rate.state,
      postcode: rate.postcode,
      city: rate.city,
      rate: rate.rate,
      name: rate.name,
      priority: rate.priority,
      compound: rate.compound,
      shipping: rate.shipping,
      class: rate.class || 'standard',
    });
    setShowRateForm(true);
  };

  const handleSaveRate = async () => {
    if (!service || !rateForm.rate.trim()) {
      showToast('Tax rate is required', 'error');
      return;
    }
    setSaving(true);
    const data: TaxRateUpdateData = {
      country: rateForm.country,
      state: rateForm.state,
      postcode: rateForm.postcode,
      city: rateForm.city,
      rate: rateForm.rate,
      name: rateForm.name,
      priority: rateForm.priority,
      compound: rateForm.compound,
      shipping: rateForm.shipping,
      class: rateForm.class,
    };

    const result = editingRateId
      ? await service.updateTaxRate(editingRateId, data)
      : await service.createTaxRate(data);

    if (result.success) {
      showToast(editingRateId ? 'Tax rate updated' : 'Tax rate created', 'success');
      setShowRateForm(false);
      setEditingRateId(null);
      setRateForm(defaultRateForm);
      await loadData();
    } else {
      showToast(result.error || 'Failed to save tax rate', 'error');
    }
    setSaving(false);
  };

  // Class CRUD
  const handleCreateClass = async () => {
    if (!service || !newClassName.trim()) {
      showToast('Class name is required', 'error');
      return;
    }
    setSaving(true);
    const result = await service.createTaxClass({ name: newClassName });
    if (result.success) {
      showToast('Tax class created', 'success');
      setShowClassForm(false);
      setNewClassName('');
      await loadData();
    } else {
      showToast(result.error || 'Failed to create tax class', 'error');
    }
    setSaving(false);
  };

  // Delete
  const handleDelete = async () => {
    if (!service) return;
    setDeleting(true);

    if (deleteConfirm.type === 'rate' && deleteConfirm.id) {
      const result = await service.deleteTaxRate(deleteConfirm.id);
      if (result.success) {
        showToast('Tax rate deleted', 'success');
      } else {
        showToast(result.error || 'Failed to delete', 'error');
      }
    } else if (deleteConfirm.type === 'class' && deleteConfirm.slug) {
      const result = await service.deleteTaxClass(deleteConfirm.slug);
      if (result.success) {
        showToast('Tax class deleted', 'success');
      } else {
        showToast(result.error || 'Failed to delete', 'error');
      }
    }

    setDeleteConfirm({ isOpen: false, type: 'rate', id: null, slug: null });
    await loadData();
    setDeleting(false);
  };

  // Stats
  const stats = useMemo(() => {
    const uniqueCountries = new Set(taxRates.map((r) => r.country).filter(Boolean));
    const avgRate =
      taxRates.length > 0
        ? taxRates.reduce((sum, r) => sum + parseFloat(r.rate || '0'), 0) / taxRates.length
        : 0;
    return {
      totalRates: taxRates.length,
      totalClasses: taxClasses.length,
      uniqueCountries: uniqueCountries.size,
      avgRate: avgRate.toFixed(2),
    };
  }, [taxRates, taxClasses]);

  if (!currentStore) {
    return <div className="p-6 text-gray-500">Please configure a store first.</div>;
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader
        title="Tax Settings"
        description="Manage tax rates and tax classes for your store"
        icon={Receipt}
      />

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="Tax Rates" value={stats.totalRates} icon={Percent} />
        <StatCard label="Tax Classes" value={stats.totalClasses} icon={Tag} />
        <StatCard label="Countries" value={stats.uniqueCountries} icon={Globe} />
        <StatCard label="Avg Rate" value={`${stats.avgRate}%`} icon={Percent} />
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-gray-200 dark:border-gray-700">
        <button
          onClick={() => setActiveTab('rates')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'rates'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Tax Rates ({taxRates.length})
        </button>
        <button
          onClick={() => setActiveTab('classes')}
          className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
            activeTab === 'classes'
              ? 'border-blue-600 text-blue-600 dark:text-blue-400'
              : 'border-transparent text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
          }`}
        >
          Tax Classes ({taxClasses.length})
        </button>
      </div>

      {loading ? (
        <LoadingIndicator message="Loading tax data..." />
      ) : activeTab === 'rates' ? (
        <>
          {/* Rate Actions */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={filterClass}
              onChange={(e) => setFilterClass(e.target.value)}
              className="px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Classes</option>
              {taxClasses.map((tc) => (
                <option key={tc.slug} value={tc.slug}>
                  {tc.name}
                </option>
              ))}
            </select>
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={handleCreateRate}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Tax Rate
            </button>
          </div>

          {/* Rate Form */}
          {showRateForm && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                {editingRateId ? 'Edit Tax Rate' : 'New Tax Rate'}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="tax-country" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Country Code
                  </label>
                  <input
                    id="tax-country"
                    type="text"
                    value={rateForm.country}
                    onChange={(e) =>
                      setRateForm({ ...rateForm, country: e.target.value.toUpperCase() })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., BG, US, DE"
                    maxLength={2}
                  />
                </div>
                <div>
                  <label htmlFor="tax-state" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    State Code
                  </label>
                  <input
                    id="tax-state"
                    type="text"
                    value={rateForm.state}
                    onChange={(e) => setRateForm({ ...rateForm, state: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="* for all"
                  />
                </div>
                <div>
                  <label htmlFor="tax-rate" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Rate (%) *
                  </label>
                  <input
                    id="tax-rate"
                    type="text"
                    value={rateForm.rate}
                    onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., 20.0000"
                  />
                </div>
                <div>
                  <label htmlFor="tax-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax Name
                  </label>
                  <input
                    id="tax-name"
                    type="text"
                    value={rateForm.name}
                    onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="e.g., VAT, GST"
                  />
                </div>
                <div>
                  <label htmlFor="tax-postcode" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Postcode
                  </label>
                  <input
                    id="tax-postcode"
                    type="text"
                    value={rateForm.postcode}
                    onChange={(e) => setRateForm({ ...rateForm, postcode: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="* for all"
                  />
                </div>
                <div>
                  <label htmlFor="tax-city" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    City
                  </label>
                  <input
                    id="tax-city"
                    type="text"
                    value={rateForm.city}
                    onChange={(e) => setRateForm({ ...rateForm, city: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    placeholder="* for all"
                  />
                </div>
                <div>
                  <label htmlFor="tax-class" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Tax Class
                  </label>
                  <select
                    id="tax-class"
                    value={rateForm.class}
                    onChange={(e) => setRateForm({ ...rateForm, class: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  >
                    {taxClasses.map((tc) => (
                      <option key={tc.slug} value={tc.slug}>
                        {tc.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="tax-priority" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Priority
                  </label>
                  <input
                    id="tax-priority"
                    type="number"
                    value={rateForm.priority}
                    onChange={(e) =>
                      setRateForm({ ...rateForm, priority: parseInt(e.target.value) || 1 })
                    }
                    className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                    min={1}
                  />
                </div>
                <div className="flex items-center gap-6 pt-6">
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={rateForm.compound}
                      onChange={(e) => setRateForm({ ...rateForm, compound: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    Compound
                  </label>
                  <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                    <input
                      type="checkbox"
                      checked={rateForm.shipping}
                      onChange={(e) => setRateForm({ ...rateForm, shipping: e.target.checked })}
                      className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                    />
                    Apply to shipping
                  </label>
                </div>
              </div>
              <div className="flex items-center gap-3 pt-2">
                <button
                  onClick={handleSaveRate}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : editingRateId ? 'Update' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowRateForm(false);
                    setEditingRateId(null);
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Rates Table */}
          {filteredRates.length === 0 ? (
            <EmptyState
              icon={Receipt}
              title="No tax rates found"
              description="Create tax rates for your store's jurisdictions."
              actionLabel="Add Tax Rate"
              onAction={handleCreateRate}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Country
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      State
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Rate
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Class
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Priority
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Options
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredRates.map((rate) => (
                    <tr
                      key={rate.id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                    >
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {rate.country || '*'}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {rate.state || '*'}
                      </td>
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                        {parseFloat(rate.rate).toFixed(4)}%
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                        {rate.name}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                          {rate.class || 'standard'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {rate.priority}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          {rate.compound && (
                            <span className="text-xs bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded">
                              Compound
                            </span>
                          )}
                          {rate.shipping && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                              Shipping
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleEditRate(rate)}
                            className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                isOpen: true,
                                type: 'rate',
                                id: rate.id,
                                slug: null,
                              })
                            }
                            className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      ) : (
        <>
          {/* Tax Classes Tab */}
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
            <button
              onClick={() => setShowClassForm(true)}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Tax Class
            </button>
          </div>

          {/* Class Form */}
          {showClassForm && (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                New Tax Class
              </h3>
              <div>
                <label htmlFor="tax-class-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Name *
                </label>
                <input
                  id="tax-class-name"
                  type="text"
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Reduced Rate, Zero Rate"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleCreateClass}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  <Save className="w-4 h-4" />
                  {saving ? 'Saving...' : 'Create'}
                </button>
                <button
                  onClick={() => {
                    setShowClassForm(false);
                    setNewClassName('');
                  }}
                  className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
                >
                  <X className="w-4 h-4" />
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Classes List */}
          {taxClasses.length === 0 ? (
            <EmptyState
              icon={Tag}
              title="No tax classes found"
              description="Tax classes are used to group tax rates."
              actionLabel="Add Tax Class"
              onAction={() => setShowClassForm(true)}
            />
          ) : (
            <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
              <table className="w-full">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700">
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Name
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Slug
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Rates
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {taxClasses.map((tc) => {
                    const rateCount = taxRates.filter(
                      (r) => (r.class || 'standard') === tc.slug
                    ).length;
                    const isStandard = tc.slug === 'standard';

                    return (
                      <tr
                        key={tc.slug}
                        className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors"
                      >
                        <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                          {tc.name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {tc.slug}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {rateCount} rate{rateCount !== 1 ? 's' : ''}
                        </td>
                        <td className="px-4 py-3">
                          {!isStandard && (
                            <button
                              onClick={() =>
                                setDeleteConfirm({
                                  isOpen: true,
                                  type: 'class',
                                  id: null,
                                  slug: tc.slug,
                                })
                              }
                              className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                              title="Delete class"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          {isStandard && (
                            <span className="text-xs text-gray-400">Built-in</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.type === 'rate' ? 'Delete Tax Rate' : 'Delete Tax Class'}
        message={
          deleteConfirm.type === 'rate'
            ? 'Are you sure you want to delete this tax rate?'
            : 'Are you sure you want to delete this tax class? Associated rates will need reassignment.'
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() =>
          setDeleteConfirm({ isOpen: false, type: 'rate', id: null, slug: null })
        }
      />
    </div>
  );
}

export default TaxPage;
