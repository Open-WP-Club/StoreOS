import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import LoadingIndicator from '../components/LoadingIndicator';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import { useToast } from '../hooks/useToast';
import { useOfflineMutation } from '../hooks/useOfflineMutation';
import { usePlaceholders } from '../utils/offlinePlaceholders';
import ToastContainer from '../components/ToastContainer';
import StatCard from '../components/StatCard';
import TaxRatesTab from '../components/TaxRatesTab';
import TaxClassesTab from '../components/TaxClassesTab';
import { Receipt, Globe, Percent, Tag } from 'lucide-react';
import type { WooCommerceTaxRate, WooCommerceTaxClass, TaxRateUpdateData } from '../types';

export interface TaxRateFormData {
  country: string;
  state: string;
  postcode: string;
  city: string;
  rate: string;
  name: string;
  priority: number | '';
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

  const [loadedRates, setTaxRates] = useState<WooCommerceTaxRate[]>([]);
  const [loadedClasses, setTaxClasses] = useState<WooCommerceTaxClass[]>([]);
  const pendingRates = usePlaceholders('tax_rate', currentStore?.id);
  const pendingClasses = usePlaceholders('tax_class', currentStore?.id);
  const taxRates = useMemo(() => [...loadedRates, ...pendingRates], [loadedRates, pendingRates]);
  const taxClasses = useMemo(
    () => [
      ...loadedClasses,
      // a class that now exists on the server is no longer pending
      ...pendingClasses.filter((p) => !loadedClasses.some((c) => c.slug === p.slug)),
    ],
    [loadedClasses, pendingClasses]
  );
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

  const { mutateApi } = useOfflineMutation();

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
      priority: rateForm.priority || 1,
      compound: rateForm.compound,
      shipping: rateForm.shipping,
      class: rateForm.class,
    };

    const res = await mutateApi(
      editingRateId ? 'update_tax_rate' : 'create_tax_rate',
      editingRateId ? { id: editingRateId, ...data } : { ...data },
      currentStore!.id,
      () =>
        editingRateId ? service.updateTaxRate(editingRateId, data) : service.createTaxRate(data),
      (msg) => showToast(msg, 'error'),
      'Failed to save tax rate'
    );
    if (res.queued || res.success) {
      if (res.success)
        showToast(editingRateId ? 'Tax rate updated' : 'Tax rate created', 'success');
      else if (editingRateId) {
        setTaxRates((prev) => prev.map((r) => (r.id === editingRateId ? { ...r, ...data } : r)));
      }
      setShowRateForm(false);
      setEditingRateId(null);
      setRateForm(defaultRateForm);
      if (res.success) await loadData();
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
    const res = await mutateApi(
      'create_tax_class',
      { name: newClassName },
      currentStore!.id,
      () => service.createTaxClass({ name: newClassName }),
      (msg) => showToast(msg, 'error'),
      'Failed to create tax class'
    );
    if (res.queued || res.success) {
      if (res.success) {
        showToast('Tax class created', 'success');
        await loadData();
      }
      setShowClassForm(false);
      setNewClassName('');
    }
    setSaving(false);
  };

  // Delete
  const handleDelete = async () => {
    if (!service) return;
    setDeleting(true);

    const { id, slug } = deleteConfirm;
    let queued = false;
    if (deleteConfirm.type === 'rate' && id) {
      const res = await mutateApi(
        'delete_tax_rate',
        { id },
        currentStore!.id,
        () => service.deleteTaxRate(id),
        (msg) => showToast(msg, 'error'),
        'Failed to delete'
      );
      queued = res.queued;
      if (res.queued) setTaxRates((prev) => prev.filter((r) => r.id !== id));
      if (res.success) showToast('Tax rate deleted', 'success');
    } else if (deleteConfirm.type === 'class' && slug) {
      const pendingId = taxClasses.find((c) => c.slug === slug && c._pending)?.id;
      const res = await mutateApi(
        'delete_tax_class',
        // a pending class carries its temp id so the delete cancels the queued create
        { slug, ...(pendingId !== undefined && { id: pendingId }) },
        currentStore!.id,
        () => service.deleteTaxClass(slug),
        (msg) => showToast(msg, 'error'),
        'Failed to delete'
      );
      queued = res.queued;
      if (res.queued) setTaxClasses((prev) => prev.filter((c) => c.slug !== slug));
      if (res.success) showToast('Tax class deleted', 'success');
    }

    setDeleteConfirm({ isOpen: false, type: 'rate', id: null, slug: null });
    if (!queued) await loadData();
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
          onDeleteRate={(id) => setDeleteConfirm({ isOpen: true, type: 'rate', id, slug: null })}
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
        onCancel={() => setDeleteConfirm({ isOpen: false, type: 'rate', id: null, slug: null })}
      />
    </div>
  );
}

export default TaxPage;
