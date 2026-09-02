import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import LoadingIndicator from '../components/LoadingIndicator';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';
import StatCard from '../components/StatCard';
import TaxRatesTab from '../components/TaxRatesTab';
import TaxClassesTab from '../components/TaxClassesTab';
import { Receipt, Globe, Percent, Tag } from 'lucide-react';
import type {
  WooCommerceTaxRate,
  WooCommerceTaxClass,
  TaxRateUpdateData,
} from '../types';

export interface TaxRateFormData {
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
        <TaxRatesTab
          taxRates={taxRates}
          filteredRates={filteredRates}
          taxClasses={taxClasses}
          filterClass={filterClass}
          onFilterClassChange={setFilterClass}
          loadData={loadData}
          loading={loading}
          showRateForm={showRateForm}
          editingRateId={editingRateId}
          rateForm={rateForm}
          onRateFormChange={setRateForm}
          onCreateRate={handleCreateRate}
          onSaveRate={handleSaveRate}
          onCancelRateForm={() => {
            setShowRateForm(false);
            setEditingRateId(null);
          }}
          saving={saving}
          onEditRate={handleEditRate}
          onDeleteRate={(id) =>
            setDeleteConfirm({ isOpen: true, type: 'rate', id, slug: null })
          }
        />
      ) : (
        <TaxClassesTab
          taxClasses={taxClasses}
          taxRates={taxRates}
          loadData={loadData}
          loading={loading}
          showClassForm={showClassForm}
          onShowClassForm={setShowClassForm}
          newClassName={newClassName}
          onNewClassNameChange={setNewClassName}
          onCreateClass={handleCreateClass}
          onCancelClassForm={() => {
            setShowClassForm(false);
            setNewClassName('');
          }}
          saving={saving}
          onDeleteClass={(slug) =>
            setDeleteConfirm({ isOpen: true, type: 'class', id: null, slug })
          }
        />
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
