import React from 'react';
import EmptyState from './EmptyState';
import { RefreshCw, Plus, Edit, Trash2, Save, X, Receipt } from 'lucide-react';
import type { WooCommerceTaxRate, WooCommerceTaxClass } from '../types';
import type { TaxRateFormData } from '../pages/TaxPage';

interface TaxRatesTabProps {
  taxRates: WooCommerceTaxRate[];
  filteredRates: WooCommerceTaxRate[];
  taxClasses: WooCommerceTaxClass[];
  filterClass: string;
  onFilterClassChange: (value: string) => void;
  loadData: () => void;
  loading: boolean;
  showRateForm: boolean;
  editingRateId: number | null;
  rateForm: TaxRateFormData;
  onRateFormChange: (form: TaxRateFormData) => void;
  onCreateRate: () => void;
  onSaveRate: () => void;
  onCancelRateForm: () => void;
  saving: boolean;
  onEditRate: (rate: WooCommerceTaxRate) => void;
  onDeleteRate: (id: number) => void;
}

function TaxRatesTab({
  filteredRates,
  taxClasses,
  filterClass,
  onFilterClassChange,
  loadData,
  loading,
  showRateForm,
  editingRateId,
  rateForm,
  onRateFormChange,
  onCreateRate,
  onSaveRate,
  onCancelRateForm,
  saving,
  onEditRate,
  onDeleteRate,
}: TaxRatesTabProps): React.ReactElement {
  return (
    <>
      {/* Rate Actions */}
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={filterClass}
          onChange={(e) => onFilterClassChange(e.target.value)}
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
          onClick={onCreateRate}
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
                  onRateFormChange({ ...rateForm, country: e.target.value.toUpperCase() })
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
                onChange={(e) => onRateFormChange({ ...rateForm, state: e.target.value })}
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
                onChange={(e) => onRateFormChange({ ...rateForm, rate: e.target.value })}
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
                onChange={(e) => onRateFormChange({ ...rateForm, name: e.target.value })}
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
                onChange={(e) => onRateFormChange({ ...rateForm, postcode: e.target.value })}
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
                onChange={(e) => onRateFormChange({ ...rateForm, city: e.target.value })}
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
                onChange={(e) => onRateFormChange({ ...rateForm, class: e.target.value })}
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
                  onRateFormChange({ ...rateForm, priority: parseInt(e.target.value) || 1 })
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
                  onChange={(e) => onRateFormChange({ ...rateForm, compound: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                Compound
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                  type="checkbox"
                  checked={rateForm.shipping}
                  onChange={(e) => onRateFormChange({ ...rateForm, shipping: e.target.checked })}
                  className="rounded border-gray-300 dark:border-gray-600 text-blue-600 focus:ring-blue-500"
                />
                Apply to shipping
              </label>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button
              onClick={onSaveRate}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : editingRateId ? 'Update' : 'Create'}
            </button>
            <button
              onClick={onCancelRateForm}
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
          onAction={onCreateRate}
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
                        onClick={() => onEditRate(rate)}
                        className="p-1.5 rounded text-blue-600 hover:bg-blue-50 dark:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                      >
                        <Edit className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => onDeleteRate(rate.id)}
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
  );
}

export default TaxRatesTab;
