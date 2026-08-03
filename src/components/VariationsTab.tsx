import React, { useState, useEffect, useCallback, useMemo, useRef, ReactElement, ChangeEvent } from 'react';
import { Plus, Trash2, Save, Loader2, ChevronDown, ChevronUp, Layers } from 'lucide-react';
import WooCommerceService from '../services/woocommerce';
import { formatPrice } from '../utils/currency';
import type {
  WooCommerceStore,
  WooCommerceProduct,
  ProductVariation,
  VariationCreateData,
  VariationAttribute,
  ProductAttribute,
} from '../types';

interface VariationsTabProps {
  product: WooCommerceProduct;
  storeConfig: WooCommerceStore;
}

interface VariationFormData {
  regular_price: string;
  sale_price: string;
  sku: string;
  manage_stock: boolean;
  stock_quantity: string;
  stock_status: 'instock' | 'outofstock' | 'onbackorder';
  status: 'publish' | 'private' | 'draft';
  attributes: VariationAttribute[];
}

const emptyForm = (attrs: ProductAttribute[]): VariationFormData => ({
  regular_price: '',
  sale_price: '',
  sku: '',
  manage_stock: false,
  stock_quantity: '',
  stock_status: 'instock',
  status: 'publish',
  attributes: attrs
    .filter((a) => a.variation)
    .map((a) => ({ id: a.id, name: a.name, option: '' })),
});

function VariationsTab({ product, storeConfig }: VariationsTabProps): ReactElement {
  const [variations, setVariations] = useState<ProductVariation[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Inline edit state
  const [editData, setEditData] = useState<Record<number, Partial<VariationFormData>>>({});

  // Add form state
  const variationAttrs = useMemo(
    () => product.attributes.filter((a) => a.variation),
    [product.attributes]
  );
  const [addForm, setAddForm] = useState<VariationFormData>(emptyForm(product.attributes));

  const service = useMemo(() => new WooCommerceService(storeConfig), [storeConfig]);

  const showMessage = useCallback((msg: string, type: 'success' | 'error'): void => {
    if (type === 'success') {
      setSuccessMsg(msg);
      setError(null);
    } else {
      setError(msg);
      setSuccessMsg(null);
    }
    setTimeout(() => {
      setSuccessMsg(null);
      setError(null);
    }, 3000);
  }, []);

  const fetchVariations = useCallback(async (): Promise<void> => {
    setLoading(true);
    const result = await service.getProductVariations(product.id);
    if (result.success) {
      setVariations(result.data);
    } else {
      setError(result.error || 'Failed to load variations');
    }
    setLoading(false);
  }, [product.id, service]);

  const fetchedProductIdRef = useRef<number | null>(null);
  useEffect(() => {
    if (fetchedProductIdRef.current !== product.id) {
      fetchedProductIdRef.current = product.id;
      fetchVariations();
    }
  }, [product.id, fetchVariations]);

  // Handle inline field change for an existing variation
  const handleEditField = useCallback((
    variationId: number,
    field: keyof VariationFormData,
    value: string | boolean
  ): void => {
    setEditData((prev) => ({
      ...prev,
      [variationId]: {
        ...prev[variationId],
        [field]: value,
      },
    }));
  }, []);

  // Save inline edits for a variation
  const handleSaveVariation = useCallback(async (variation: ProductVariation): Promise<void> => {
    const changes = editData[variation.id];
    if (!changes) return;

    setSaving(true);
    const updatePayload: Record<string, unknown> = { ...changes };
    if ('stock_quantity' in changes) {
      updatePayload.stock_quantity =
        changes.stock_quantity === '' ? null : parseInt(changes.stock_quantity as string);
    }

    const result = await service.updateProductVariation(product.id, variation.id, updatePayload);
    if (result.success) {
      setVariations((prev) => prev.map((v) => (v.id === variation.id ? result.data : v)));
      setEditData((prev) => {
        const next = { ...prev };
        delete next[variation.id];
        return next;
      });
      showMessage('Variation updated', 'success');
    } else {
      showMessage(result.error || 'Update failed', 'error');
    }
    setSaving(false);
  }, [editData, service, product.id, showMessage]);

  // Delete a variation
  const handleDelete = useCallback(async (variationId: number): Promise<void> => {
    if (!confirm('Delete this variation? This cannot be undone.')) return;

    setDeletingId(variationId);
    const result = await service.deleteProductVariation(product.id, variationId);
    if (result.success) {
      setVariations((prev) => prev.filter((v) => v.id !== variationId));
      showMessage('Variation deleted', 'success');
    } else {
      showMessage(result.error || 'Delete failed', 'error');
    }
    setDeletingId(null);
  }, [service, product.id, showMessage]);

  // Create a new variation
  const handleCreate = useCallback(async (): Promise<void> => {
    // Validate at least one attribute selected
    const hasAttrs = addForm.attributes.some((a) => a.option !== '');
    if (!hasAttrs) {
      showMessage('Select at least one attribute option', 'error');
      return;
    }

    setSaving(true);
    const payload: VariationCreateData = {
      regular_price: addForm.regular_price,
      sale_price: addForm.sale_price || undefined,
      sku: addForm.sku || undefined,
      manage_stock: addForm.manage_stock,
      stock_quantity: addForm.manage_stock ? parseInt(addForm.stock_quantity) || 0 : undefined,
      stock_status: addForm.stock_status,
      status: addForm.status,
      attributes: addForm.attributes.filter((a) => a.option !== ''),
    };

    const result = await service.createProductVariation(product.id, payload);
    if (result.success) {
      setVariations((prev) => [...prev, result.data]);
      setAddForm(emptyForm(product.attributes));
      setShowAddForm(false);
      showMessage('Variation created', 'success');
    } else {
      showMessage(result.error || 'Create failed', 'error');
    }
    setSaving(false);
  }, [addForm, service, product.id, product.attributes, showMessage]);

  // Generate all missing attribute combinations
  const handleGenerateAll = useCallback(async (): Promise<void> => {
    if (variationAttrs.length === 0) return;

    // Build all possible combinations
    const optionSets = variationAttrs.map((attr) =>
      attr.options.map((opt) => ({ id: attr.id, name: attr.name, option: opt }))
    );

    const combinations: VariationAttribute[][] = optionSets.reduce<VariationAttribute[][]>(
      (acc, options) => {
        if (acc.length === 0) return options.map((o) => [o]);
        return acc.flatMap((combo) => options.map((o) => [...combo, o]));
      },
      []
    );

    // Filter out combinations that already exist
    const existingKeys = new Set(
      variations.map((v) =>
        v.attributes
          .map((a) => `${a.name}:${a.option}`)
          .sort()
          .join('|')
      )
    );

    const missing = combinations.filter((combo) => {
      const key = combo
        .map((a) => `${a.name}:${a.option}`)
        .sort()
        .join('|');
      return !existingKeys.has(key);
    });

    if (missing.length === 0) {
      showMessage('All combinations already exist', 'success');
      return;
    }

    setGenerating(true);
    const batchData: VariationCreateData[] = missing.map((attrs) => ({
      attributes: attrs,
      status: 'publish' as const,
    }));

    const result = await service.batchProductVariations(product.id, { create: batchData });
    if (result.success && result.data.create) {
      setVariations((prev) => [...prev, ...result.data.create!]);
      showMessage(`${result.data.create.length} variations generated`, 'success');
    } else {
      showMessage(('error' in result && result.error) || 'Batch create failed', 'error');
    }
    setGenerating(false);
  }, [variationAttrs, variations, service, product.id, showMessage]);

  // Get display value for a field (edited or original)
  const getFieldValue = useCallback((
    variation: ProductVariation,
    field: keyof ProductVariation
  ): string => {
    const edited = editData[variation.id];
    if (edited && field in edited) {
      return String(edited[field as keyof VariationFormData] ?? '');
    }
    const val = variation[field];
    return val === null || val === undefined ? '' : String(val);
  }, [editData]);

  const hasEdits = useCallback((variationId: number): boolean => {
    return !!editData[variationId] && Object.keys(editData[variationId]).length > 0;
  }, [editData]);

  const handleToggleAddForm = useCallback((): void => {
    setShowAddForm((prev) => !prev);
  }, []);

  const handleCancelAddForm = useCallback((): void => {
    setShowAddForm(false);
    setAddForm(emptyForm(product.attributes));
  }, [product.attributes]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-blue-500" />
        <span className="ml-2 text-gray-500 dark:text-gray-400">Loading variations...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Messages */}
      {error && (
        <div className="px-4 py-2 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg text-sm text-red-700 dark:text-red-300">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="px-4 py-2 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-800 rounded-lg text-sm text-green-700 dark:text-green-300">
          {successMsg}
        </div>
      )}

      {/* Action bar */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {variations.length} variation{variations.length !== 1 ? 's' : ''}
        </p>
        <div className="flex gap-2">
          {variationAttrs.length > 0 && (
            <button
              onClick={handleGenerateAll}
              disabled={generating}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 disabled:opacity-50 transition-colors"
            >
              {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Layers className="w-4 h-4" />}
              Generate All
            </button>
          )}
          <button
            onClick={handleToggleAddForm}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Variation
          </button>
        </div>
      </div>

      {/* Add Variation Form */}
      {showAddForm && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-4">
          <h4 className="font-medium text-gray-900 dark:text-white">New Variation</h4>

          {/* Attribute selectors */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {variationAttrs.map((attr, idx) => (
              <div key={attr.id}>
                <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  {attr.name}
                </label>
                <select
                  value={addForm.attributes[idx]?.option || ''}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                    const newAttrs = [...addForm.attributes];
                    if (newAttrs[idx]) {
                      newAttrs[idx] = { ...newAttrs[idx], option: e.target.value };
                    }
                    setAddForm({ ...addForm, attributes: newAttrs });
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                >
                  <option value="">Select...</option>
                  {attr.options.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>

          {/* Price & SKU */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div>
              <label htmlFor="add-var-regular-price" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Regular Price
              </label>
              <input
                id="add-var-regular-price"
                type="text"
                value={addForm.regular_price}
                onChange={(e) => setAddForm({ ...addForm, regular_price: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="add-var-sale-price" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Sale Price
              </label>
              <input
                id="add-var-sale-price"
                type="text"
                value={addForm.sale_price}
                onChange={(e) => setAddForm({ ...addForm, sale_price: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                placeholder="0.00"
              />
            </div>
            <div>
              <label htmlFor="add-var-sku" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                SKU
              </label>
              <input
                id="add-var-sku"
                type="text"
                value={addForm.sku}
                onChange={(e) => setAddForm({ ...addForm, sku: e.target.value })}
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
              />
            </div>
            <div>
              <label htmlFor="add-var-stock" className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                Stock
              </label>
              <input
                id="add-var-stock"
                type="number"
                value={addForm.stock_quantity}
                onChange={(e) =>
                  setAddForm({ ...addForm, stock_quantity: e.target.value, manage_stock: true })
                }
                className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                placeholder="0"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancelAddForm}
              className="px-3 py-1.5 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 rounded-md transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              Create
            </button>
          </div>
        </div>
      )}

      {/* Variations Table */}
      {variations.length === 0 ? (
        <div className="text-center py-12 text-gray-500 dark:text-gray-400">
          <Layers className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="font-medium">No variations yet</p>
          <p className="text-sm mt-1">Add variations or click &ldquo;Generate All&rdquo; to create combinations from attributes.</p>
        </div>
      ) : (
        <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase w-8" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Attributes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Price
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  SKU
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Stock
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {variations.map((variation) => (
                <VariationRow
                  key={variation.id}
                  variation={variation}
                  product={product}
                  expanded={expandedId === variation.id}
                  onToggle={() => setExpandedId(expandedId === variation.id ? null : variation.id)}
                  getFieldValue={getFieldValue}
                  hasEdits={hasEdits(variation.id)}
                  onEditField={(field, value) => handleEditField(variation.id, field, value)}
                  onSave={() => handleSaveVariation(variation)}
                  onDelete={() => handleDelete(variation.id)}
                  saving={saving}
                  deleting={deletingId === variation.id}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ============================================
// Variation Row sub-component
// ============================================

interface VariationRowProps {
  variation: ProductVariation;
  product: WooCommerceProduct;
  expanded: boolean;
  onToggle: () => void;
  getFieldValue: (v: ProductVariation, field: keyof ProductVariation) => string;
  hasEdits: boolean;
  onEditField: (field: keyof VariationFormData, value: string | boolean) => void;
  onSave: () => void;
  onDelete: () => void;
  saving: boolean;
  deleting: boolean;
}

const VariationRow = React.memo(function VariationRow({
  variation,
  product,
  expanded,
  onToggle,
  getFieldValue,
  hasEdits,
  onEditField,
  onSave,
  onDelete,
  saving,
  deleting,
}: VariationRowProps): ReactElement {
  const attrLabel = useMemo(
    () => variation.attributes.map((a) => `${a.name}: ${a.option}`).join(' | '),
    [variation.attributes]
  );

  const stockDisplay = useMemo(
    () =>
      variation.manage_stock && variation.stock_quantity !== null
        ? String(variation.stock_quantity)
        : variation.stock_status,
    [variation.manage_stock, variation.stock_quantity, variation.stock_status]
  );

  return (
    <>
      <tr className="hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
        <td className="px-4 py-3">
          <button onClick={onToggle} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200">
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </td>
        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
          {attrLabel || `#${variation.id}`}
        </td>
        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
          {variation.sale_price ? (
            <span>
              <span className="line-through text-gray-400 mr-1">
                {formatPrice(variation.regular_price, product.categories?.[0] ? undefined : null)}
              </span>
              {formatPrice(variation.sale_price)}
            </span>
          ) : (
            formatPrice(variation.regular_price || variation.price)
          )}
        </td>
        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 font-mono">
          {variation.sku || '-'}
        </td>
        <td className="px-4 py-3 text-sm">
          <span
            className={`${
              variation.stock_status === 'outofstock'
                ? 'text-red-600 dark:text-red-400'
                : variation.stock_status === 'onbackorder'
                  ? 'text-yellow-600 dark:text-yellow-400'
                  : 'text-green-600 dark:text-green-400'
            }`}
          >
            {stockDisplay}
          </span>
        </td>
        <td className="px-4 py-3 text-sm">
          <span
            className={`px-2 py-0.5 rounded-full text-xs font-medium ${
              variation.status === 'publish'
                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400'
            }`}
          >
            {variation.status}
          </span>
        </td>
        <td className="px-4 py-3 text-right">
          <div className="flex items-center justify-end gap-1">
            {hasEdits && (
              <button
                onClick={onSave}
                disabled={saving}
                className="p-1.5 text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
                title="Save changes"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              </button>
            )}
            <button
              onClick={onDelete}
              disabled={deleting}
              className="p-1.5 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Delete variation"
            >
              {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </button>
          </div>
        </td>
      </tr>

      {/* Expanded inline edit row */}
      {expanded && (
        <tr className="bg-gray-50 dark:bg-gray-700/30">
          <td colSpan={7} className="px-8 py-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label htmlFor={`var-${variation.id}-price`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Regular Price
                </label>
                <input
                  id={`var-${variation.id}-price`}
                  type="text"
                  value={getFieldValue(variation, 'regular_price')}
                  onChange={(e) => onEditField('regular_price', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                />
              </div>
              <div>
                <label htmlFor={`var-${variation.id}-sale`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Sale Price
                </label>
                <input
                  id={`var-${variation.id}-sale`}
                  type="text"
                  value={getFieldValue(variation, 'sale_price')}
                  onChange={(e) => onEditField('sale_price', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                />
              </div>
              <div>
                <label htmlFor={`var-${variation.id}-sku`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  SKU
                </label>
                <input
                  id={`var-${variation.id}-sku`}
                  type="text"
                  value={getFieldValue(variation, 'sku')}
                  onChange={(e) => onEditField('sku', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                />
              </div>
              <div>
                <label htmlFor={`var-${variation.id}-qty`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Stock Quantity
                </label>
                <input
                  id={`var-${variation.id}-qty`}
                  type="number"
                  value={getFieldValue(variation, 'stock_quantity')}
                  onChange={(e) => {
                    onEditField('stock_quantity', e.target.value);
                    onEditField('manage_stock', true);
                  }}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                />
              </div>
              <div>
                <label htmlFor={`var-${variation.id}-stock-status`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Stock Status
                </label>
                <select
                  id={`var-${variation.id}-stock-status`}
                  value={getFieldValue(variation, 'stock_status')}
                  onChange={(e) => onEditField('stock_status', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                >
                  <option value="instock">In Stock</option>
                  <option value="outofstock">Out of Stock</option>
                  <option value="onbackorder">On Backorder</option>
                </select>
              </div>
              <div>
                <label htmlFor={`var-${variation.id}-status`} className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
                  Status
                </label>
                <select
                  id={`var-${variation.id}-status`}
                  value={getFieldValue(variation, 'status')}
                  onChange={(e) => onEditField('status', e.target.value)}
                  className="w-full px-2 py-1.5 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
                >
                  <option value="publish">Published</option>
                  <option value="private">Private</option>
                  <option value="draft">Draft</option>
                </select>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
});

export default React.memo(VariationsTab);
