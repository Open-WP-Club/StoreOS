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
  Search,
  Plus,
  Edit,
  Trash2,
  FolderTree,
  ChevronRight,
  ChevronDown,
  Save,
  X,
  Package,
} from 'lucide-react';
import type {
  WooCommerceProductCategory,
  ProductCategoryUpdateData,
} from '../types';

interface CategoryFormData {
  name: string;
  slug: string;
  parent: number;
  description: string;
  display: 'default' | 'products' | 'subcategories' | 'both';
}

const defaultFormData: CategoryFormData = {
  name: '',
  slug: '',
  parent: 0,
  description: '',
  display: 'default',
};

function CategoriesPage(): React.ReactElement {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();
  const { toasts, showToast, removeToast } = useToast();

  const [categories, setCategories] = useState<WooCommerceProductCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>(defaultFormData);
  const [saving, setSaving] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());
  const [deleteConfirm, setDeleteConfirm] = useState<{ isOpen: boolean; id: number | null }>({
    isOpen: false,
    id: null,
  });
  const [deleting, setDeleting] = useState(false);

  const service = useMemo(
    () => (currentStore ? new WooCommerceService(currentStore) : null),
    [currentStore]
  );

  const loadCategories = useCallback(async () => {
    if (!service) return;
    setLoading(true);
    const result = await service.getProductCategories({ per_page: 100, hide_empty: false });
    if (result.success) {
      setCategories(result.data);
    } else {
      showToast(result.error || 'Failed to load categories', 'error');
    }
    setLoading(false);
  }, [service, showToast]);

  const [prevLoadCategories, setPrevLoadCategories] = useState(() => loadCategories);
  if (prevLoadCategories !== loadCategories) {
    setPrevLoadCategories(() => loadCategories);
    loadCategories();
  }

  // Build tree structure
  const categoryTree = useMemo(() => {
    const map = new Map<number, WooCommerceProductCategory & { children: WooCommerceProductCategory[] }>();
    const roots: (WooCommerceProductCategory & { children: WooCommerceProductCategory[] })[] = [];

    // Initialize all categories with children array
    categories.forEach((cat) => {
      map.set(cat.id, { ...cat, children: [] });
    });

    // Build tree
    categories.forEach((cat) => {
      const node = map.get(cat.id)!;
      if (cat.parent === 0) {
        roots.push(node);
      } else {
        const parent = map.get(cat.parent);
        if (parent) {
          parent.children.push(node);
        } else {
          roots.push(node);
        }
      }
    });

    return roots;
  }, [categories]);

  const filteredTree = useMemo(() => {
    if (!searchQuery.trim()) return categoryTree;
    const query = searchQuery.toLowerCase();
    const matchesSearch = (cat: WooCommerceProductCategory): boolean =>
      cat.name.toLowerCase().includes(query) || cat.slug.toLowerCase().includes(query);

    const filterTree = (
      nodes: (WooCommerceProductCategory & { children: WooCommerceProductCategory[] })[]
    ): (WooCommerceProductCategory & { children: WooCommerceProductCategory[] })[] => {
      return nodes
        .map((node) => {
          const filteredChildren = filterTree(
            node.children as (WooCommerceProductCategory & { children: WooCommerceProductCategory[] })[]
          );
          if (matchesSearch(node) || filteredChildren.length > 0) {
            return { ...node, children: filteredChildren };
          }
          return null;
        })
        .filter(Boolean) as (WooCommerceProductCategory & { children: WooCommerceProductCategory[] })[];
    };
    return filterTree(categoryTree);
  }, [categoryTree, searchQuery]);

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleEdit = (cat: WooCommerceProductCategory) => {
    setEditingId(cat.id);
    setFormData({
      name: cat.name,
      slug: cat.slug,
      parent: cat.parent,
      description: cat.description,
      display: cat.display,
    });
    setShowForm(true);
  };

  const handleCreate = () => {
    setEditingId(null);
    setFormData(defaultFormData);
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!service || !formData.name.trim()) {
      showToast('Category name is required', 'error');
      return;
    }

    setSaving(true);
    const data: ProductCategoryUpdateData = {
      name: formData.name,
      slug: formData.slug || undefined,
      parent: formData.parent,
      description: formData.description,
      display: formData.display,
    };

    const result = editingId
      ? await service.updateProductCategory(editingId, data)
      : await service.createProductCategory(data);

    if (result.success) {
      showToast(editingId ? 'Category updated' : 'Category created', 'success');
      setShowForm(false);
      setEditingId(null);
      setFormData(defaultFormData);
      await loadCategories();
    } else {
      showToast(result.error || 'Failed to save category', 'error');
    }
    setSaving(false);
  };

  const handleDelete = async () => {
    if (!service || !deleteConfirm.id) return;
    setDeleting(true);
    const result = await service.deleteProductCategory(deleteConfirm.id);
    if (result.success) {
      showToast('Category deleted', 'success');
      setDeleteConfirm({ isOpen: false, id: null });
      await loadCategories();
    } else {
      showToast(result.error || 'Failed to delete category', 'error');
    }
    setDeleting(false);
  };

  const renderCategoryRow = (
    cat: WooCommerceProductCategory & { children: WooCommerceProductCategory[] },
    depth: number = 0
  ): React.ReactNode => {
    const hasChildren = cat.children && cat.children.length > 0;
    const isExpanded = expandedIds.has(cat.id);

    return (
      <React.Fragment key={cat.id}>
        <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
          <td className="px-4 py-3">
            <div className="flex items-center gap-2" style={{ paddingLeft: `${depth * 24}px` }}>
              {hasChildren ? (
                <button
                  onClick={() => toggleExpand(cat.id)}
                  className="p-0.5 rounded hover:bg-gray-200 dark:hover:bg-gray-600"
                >
                  {isExpanded ? (
                    <ChevronDown className="w-4 h-4 text-gray-500" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-gray-500" />
                  )}
                </button>
              ) : (
                <span className="w-5" />
              )}
              <FolderTree className="w-4 h-4 text-blue-500" />
              <span className="font-medium text-gray-900 dark:text-white">{cat.name}</span>
            </div>
          </td>
          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{cat.slug}</td>
          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{cat.count}</td>
          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 capitalize">
            {cat.display}
          </td>
          <td className="px-4 py-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => handleEdit(cat)}
                className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                title="Edit"
              >
                <Edit className="w-4 h-4" />
              </button>
              <button
                onClick={() => setDeleteConfirm({ isOpen: true, id: cat.id })}
                className="p-1.5 rounded text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/30 transition-colors"
                title="Delete"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </td>
        </tr>
        {hasChildren &&
          isExpanded &&
          (cat.children as (WooCommerceProductCategory & { children: WooCommerceProductCategory[] })[]).map(
            (child) => renderCategoryRow(child, depth + 1)
          )}
      </React.Fragment>
    );
  };

  if (!currentStore) {
    return <div className="p-6 text-gray-500">Please configure a store first.</div>;
  }

  return (
    <div className="space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader
        title="Product Categories"
        description="Manage your product categories and hierarchy"
        icon={FolderTree}
      />

      {/* Actions Bar */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search categories..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>
        <button
          onClick={loadCategories}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 disabled:opacity-50 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
        <button
          onClick={handleCreate}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Add Category
        </button>
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-6 space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {editingId ? 'Edit Category' : 'New Category'}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="cat-name" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Name *
              </label>
              <input
                id="cat-name"
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Category name"
              />
            </div>
            <div>
              <label htmlFor="cat-slug" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Slug
              </label>
              <input
                id="cat-slug"
                type="text"
                value={formData.slug}
                onChange={(e) => setFormData({ ...formData, slug: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Auto-generated if empty"
              />
            </div>
            <div>
              <label htmlFor="cat-parent" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Parent Category
              </label>
              <select
                id="cat-parent"
                value={formData.parent}
                onChange={(e) => setFormData({ ...formData, parent: Number(e.target.value) })}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value={0}>None (Top Level)</option>
                {categories
                  .filter((c) => c.id !== editingId)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
              </select>
            </div>
            <div>
              <label htmlFor="cat-display" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Display Type
              </label>
              <select
                id="cat-display"
                value={formData.display}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    display: e.target.value as CategoryFormData['display'],
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="default">Default</option>
                <option value="products">Products</option>
                <option value="subcategories">Subcategories</option>
                <option value="both">Both</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label htmlFor="cat-description" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Description
              </label>
              <textarea
                id="cat-description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
                placeholder="Optional description"
              />
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : editingId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={() => {
                setShowForm(false);
                setEditingId(null);
                setFormData(defaultFormData);
              }}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
            >
              <X className="w-4 h-4" />
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Categories Table */}
      {loading ? (
        <LoadingIndicator message="Loading categories..." />
      ) : categories.length === 0 ? (
        <EmptyState
          icon={Package}
          title="No categories found"
          description="Create your first product category to organize your products."
          actionLabel="Add Category"
          onAction={handleCreate}
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
                  Count
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Display
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
              {filteredTree.map((cat) => renderCategoryRow(cat))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Category"
        message="Are you sure you want to delete this category? Products assigned to it will not be deleted."
        confirmLabel="Delete"
        variant="danger"
        isLoading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteConfirm({ isOpen: false, id: null })}
      />
    </div>
  );
}

export default CategoriesPage;
