import React, { useState, useMemo, useCallback } from 'react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import LoadingIndicator from '../components/LoadingIndicator';
import ConfirmDialog from '../components/ConfirmDialog';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import { useToast } from '../hooks/useToast';
import ToastContainer from '../components/ToastContainer';
import {
  RefreshCw,
  Plus,
  Edit,
  Trash2,
  Save,
  X,
  Layers,
  Tag,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';
import type {
  WooCommerceProductAttribute,
  WooCommerceAttributeTerm,
  ProductAttributeUpdateData,
  AttributeTermUpdateData,
} from '../types';

interface AttributeFormData {
  name: string;
  slug: string;
  order_by: 'menu_order' | 'name' | 'name_num' | 'id';
  has_archives: boolean;
}

interface TermFormData {
  name: string;
  slug: string;
  description: string;
}

const defaultAttrForm: AttributeFormData = {
  name: '',
  slug: '',
  order_by: 'menu_order',
  has_archives: false,
};

const defaultTermForm: TermFormData = {
  name: '',
  slug: '',
  description: '',
};

function AttributesPage(): React.ReactElement {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();
  const { toasts, showToast, removeToast } = useToast();

  const [attributes, setAttributes] = useState<WooCommerceProductAttribute[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Attribute form
  const [showAttrForm, setShowAttrForm] = useState(false);
  const [editingAttrId, setEditingAttrId] = useState<number | null>(null);
  const [attrForm, setAttrForm] = useState<AttributeFormData>(defaultAttrForm);

  // Term management
  const [expandedAttrId, setExpandedAttrId] = useState<number | null>(null);
  const [termsMap, setTermsMap] = useState<Record<number, WooCommerceAttributeTerm[]>>({});
  const [loadingTerms, setLoadingTerms] = useState<number | null>(null);

  // Term form
  const [showTermForm, setShowTermForm] = useState(false);
  const [editingTermId, setEditingTermId] = useState<number | null>(null);
  const [termForm, setTermForm] = useState<TermFormData>(defaultTermForm);
  const [termAttrId, setTermAttrId] = useState<number | null>(null);

  // Delete
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    type: 'attribute' | 'term';
    attrId: number | null;
    termId: number | null;
  }>({ isOpen: false, type: 'attribute', attrId: null, termId: null });
  const [deleting, setDeleting] = useState(false);

  const service = useMemo(
    () => (currentStore ? new WooCommerceService(currentStore) : null),
    [currentStore]
  );

  const loadAttributes = useCallback(async () => {
    if (!service) return;
    setLoading(true);
    const result = await service.getProductAttributes();
    if (result.success) {
      setAttributes(result.data);
    } else {
      showToast(result.error || 'Failed to load attributes', 'error');
    }
    setLoading(false);
  }, [service, showToast]);

  const [prevLoadAttributes, setPrevLoadAttributes] = useState(() => loadAttributes);
  if (prevLoadAttributes !== loadAttributes) {
    setPrevLoadAttributes(() => loadAttributes);
    loadAttributes();
  }

  const loadTerms = useCallback(
    async (attrId: number) => {
      if (!service) return;
      setLoadingTerms(attrId);
      const result = await service.getAttributeTerms(attrId);
      if (result.success) {
        setTermsMap((prev) => ({ ...prev, [attrId]: result.data }));
      } else {
        showToast(result.error || 'Failed to load terms', 'error');
      }
      setLoadingTerms(null);
    },
    [service, showToast]
  );

  const toggleExpand = async (attrId: number) => {
    if (expandedAttrId === attrId) {
      setExpandedAttrId(null);
    } else {
      setExpandedAttrId(attrId);
      if (!termsMap[attrId]) {
        await loadTerms(attrId);
      }
    }
  };

  // Attribute CRUD
  const handleCreateAttr = () => {
    setEditingAttrId(null);
    setAttrForm(defaultAttrForm);
    setShowAttrForm(true);
  };

  const handleEditAttr = (attr: WooCommerceProductAttribute) => {
    setEditingAttrId(attr.id);
    setAttrForm({
      name: attr.name,
      slug: attr.slug,
      order_by: attr.order_by,
      has_archives: attr.has_archives,
    });
    setShowAttrForm(true);
  };

  const handleSaveAttr = async () => {
    if (!service || !attrForm.name.trim()) {
      showToast('Attribute name is required', 'error');
      return;
    }
    setSaving(true);
    const data: ProductAttributeUpdateData = {
      name: attrForm.name,
      slug: attrForm.slug || undefined,
      order_by: attrForm.order_by,
      has_archives: attrForm.has_archives,
    };

    const result = editingAttrId
      ? await service.updateProductAttribute(editingAttrId, data)
      : await service.createProductAttribute(data);

    if (result.success) {
      showToast(editingAttrId ? 'Attribute updated' : 'Attribute created', 'success');
      setShowAttrForm(false);
      setEditingAttrId(null);
      setAttrForm(defaultAttrForm);
      await loadAttributes();
    } else {
      showToast(result.error || 'Failed to save attribute', 'error');
    }
    setSaving(false);
  };

  // Term CRUD
  const handleCreateTerm = (attrId: number) => {
    setTermAttrId(attrId);
    setEditingTermId(null);
    setTermForm(defaultTermForm);
    setShowTermForm(true);
  };

  const handleEditTerm = (attrId: number, term: WooCommerceAttributeTerm) => {
    setTermAttrId(attrId);
    setEditingTermId(term.id);
    setTermForm({
      name: term.name,
      slug: term.slug,
      description: term.description,
    });
    setShowTermForm(true);
  };

  const handleSaveTerm = async () => {
    if (!service || !termAttrId || !termForm.name.trim()) {
      showToast('Term name is required', 'error');
      return;
    }
    setSaving(true);
    const data: AttributeTermUpdateData = {
      name: termForm.name,
      slug: termForm.slug || undefined,
      description: termForm.description || undefined,
    };

    const result = editingTermId
      ? await service.updateAttributeTerm(termAttrId, editingTermId, data)
      : await service.createAttributeTerm(termAttrId, data);

    if (result.success) {
      showToast(editingTermId ? 'Term updated' : 'Term created', 'success');
      setShowTermForm(false);
      setEditingTermId(null);
      setTermForm(defaultTermForm);
      await loadTerms(termAttrId);
    } else {
      showToast(result.error || 'Failed to save term', 'error');
    }
    setSaving(false);
  };

  // Delete
  const handleDelete = async () => {
    if (!service) return;
    setDeleting(true);

    if (deleteConfirm.type === 'attribute' && deleteConfirm.attrId) {
      const result = await service.deleteProductAttribute(deleteConfirm.attrId);
      if (result.success) {
        showToast('Attribute deleted', 'success');
        await loadAttributes();
      } else {
        showToast(result.error || 'Failed to delete', 'error');
      }
    } else if (deleteConfirm.type === 'term' && deleteConfirm.attrId && deleteConfirm.termId) {
      const result = await service.deleteAttributeTerm(deleteConfirm.attrId, deleteConfirm.termId);
      if (result.success) {
        showToast('Term deleted', 'success');
        await loadTerms(deleteConfirm.attrId);
      } else {
        showToast(result.error || 'Failed to delete', 'error');
      }
    }

    setDeleteConfirm({ isOpen: false, type: 'attribute', attrId: null, termId: null });
    setDeleting(false);
  };

  if (!currentStore) {
    return <div className="p-6 text-gray-500">Please configure a store first.</div>;
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader
        title="Product Attributes"
        description="Manage global product attributes and their terms (e.g., Color, Size)"
        icon={Layers}
      />

      {/* Actions */}
      <div className="flex items-center gap-3">
        <button
          onClick={loadAttributes}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={handleCreateAttr}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Attribute
        </button>
      </div>

      {/* Attribute Form */}
      {showAttrForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingAttrId ? 'Edit Attribute' : 'New Attribute'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="attr-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                id="attr-name"
                type="text"
                value={attrForm.name}
                onChange={(e) => setAttrForm({ ...attrForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Color, Size"
              />
            </div>
            <div>
              <label htmlFor="attr-slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slug
              </label>
              <input
                id="attr-slug"
                type="text"
                value={attrForm.slug}
                onChange={(e) => setAttrForm({ ...attrForm, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Auto-generated if empty"
              />
            </div>
            <div>
              <label htmlFor="attr-order-by" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Sort By
              </label>
              <select
                id="attr-order-by"
                value={attrForm.order_by}
                onChange={(e) =>
                  setAttrForm({
                    ...attrForm,
                    order_by: e.target.value as AttributeFormData['order_by'],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="menu_order">Custom ordering</option>
                <option value="name">Name</option>
                <option value="name_num">Name (numeric)</option>
                <option value="id">Term ID</option>
              </select>
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input
                type="checkbox"
                id="has_archives"
                checked={attrForm.has_archives}
                onChange={(e) => setAttrForm({ ...attrForm, has_archives: e.target.checked })}
                className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
              />
              <label
                htmlFor="has_archives"
                className="text-sm text-gray-700 dark:text-gray-300"
              >
                Enable archives
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSaveAttr}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : editingAttrId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowAttrForm(false);
                setEditingAttrId(null);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Term Form (inline) */}
      {showTermForm && termAttrId && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingTermId ? 'Edit Term' : 'New Term'} for &quot;{attributes.find((a) => a.id === termAttrId)?.name}&quot;
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="term-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                id="term-name"
                type="text"
                value={termForm.name}
                onChange={(e) => setTermForm({ ...termForm, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="e.g., Red, Large"
              />
            </div>
            <div>
              <label htmlFor="term-slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slug
              </label>
              <input
                id="term-slug"
                type="text"
                value={termForm.slug}
                onChange={(e) => setTermForm({ ...termForm, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Auto-generated"
              />
            </div>
            <div>
              <label htmlFor="term-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <input
                id="term-description"
                type="text"
                value={termForm.description}
                onChange={(e) => setTermForm({ ...termForm, description: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Optional"
              />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleSaveTerm}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : editingTermId ? 'Update' : 'Add Term'}
            </button>
            <button
              onClick={() => {
                setShowTermForm(false);
                setEditingTermId(null);
                setTermAttrId(null);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Attributes List */}
      {loading ? (
        <LoadingIndicator message="Loading attributes..." />
      ) : attributes.length === 0 ? (
        <EmptyState
          icon={Layers}
          title="No attributes found"
          description="Create global product attributes like Color, Size, Material."
          actionLabel="Add Attribute"
          onAction={handleCreateAttr}
        />
      ) : (
        <div className="space-y-3">
          {attributes.map((attr) => {
            const isExpanded = expandedAttrId === attr.id;
            const terms = termsMap[attr.id] || [];
            const isLoadingTerms = loadingTerms === attr.id;

            return (
              <div
                key={attr.id}
                className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Attribute Header */}
                <div className="flex items-center justify-between px-4 py-3">
                  <button
                    onClick={() => toggleExpand(attr.id)}
                    className="flex items-center gap-3 flex-1 text-left"
                  >
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-gray-500" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-gray-500" />
                    )}
                    <Layers className="w-5 h-5 text-purple-500" />
                    <div>
                      <span className="font-medium text-gray-900 dark:text-white">
                        {attr.name}
                      </span>
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400">
                        ({attr.slug}) &middot; Sort: {attr.order_by}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleCreateTerm(attr.id)}
                      className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 rounded hover:bg-green-100 dark:hover:bg-green-900/50 transition-colors"
                    >
                      <Plus className="w-3 h-3" />
                      Term
                    </button>
                    <button
                      onClick={() => handleEditAttr(attr)}
                      className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                    >
                      <Edit className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() =>
                        setDeleteConfirm({
                          isOpen: true,
                          type: 'attribute',
                          attrId: attr.id,
                          termId: null,
                        })
                      }
                      className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Terms Section */}
                {isExpanded && (
                  <div className="border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
                    {isLoadingTerms ? (
                      <div className="px-4 py-3 text-sm text-gray-500">Loading terms...</div>
                    ) : terms.length === 0 ? (
                      <div className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        No terms yet. Click &quot;+ Term&quot; to add one.
                      </div>
                    ) : (
                      <div className="divide-y divide-gray-200 dark:divide-gray-700">
                        {terms.map((term) => (
                          <div
                            key={term.id}
                            className="flex items-center justify-between px-4 py-2 pl-12"
                          >
                            <div className="flex items-center gap-2">
                              <Tag className="w-3.5 h-3.5 text-gray-400" />
                              <span className="text-sm text-gray-900 dark:text-white">
                                {term.name}
                              </span>
                              <span className="text-xs text-gray-500">({term.slug})</span>
                              {term.count > 0 && (
                                <span className="text-xs bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 px-1.5 py-0.5 rounded">
                                  {term.count} products
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => handleEditTerm(attr.id, term)}
                                className="p-1 rounded text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  setDeleteConfirm({
                                    isOpen: true,
                                    type: 'term',
                                    attrId: attr.id,
                                    termId: term.id,
                                  })
                                }
                                className="p-1 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title={deleteConfirm.type === 'attribute' ? 'Delete Attribute' : 'Delete Term'}
        message={
          deleteConfirm.type === 'attribute'
            ? 'Are you sure? This will also delete all terms for this attribute.'
            : 'Are you sure you want to delete this term?'
        }
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() =>
          setDeleteConfirm({ isOpen: false, type: 'attribute', attrId: null, termId: null })
        }
      />
    </div>
  );
}

export default AttributesPage;
