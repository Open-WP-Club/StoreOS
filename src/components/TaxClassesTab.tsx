import React from 'react';
import EmptyState from './EmptyState';
import { RefreshCw, Plus, Trash2, Save, X, Tag } from 'lucide-react';
import type { WooCommerceTaxRate, WooCommerceTaxClass } from '../types';

interface TaxClassesTabProps {
  taxClasses: WooCommerceTaxClass[];
  taxRates: WooCommerceTaxRate[];
  loadData: () => void;
  loading: boolean;
  showClassForm: boolean;
  onShowClassForm: (show: boolean) => void;
  newClassName: string;
  onNewClassNameChange: (value: string) => void;
  onCreateClass: () => void;
  onCancelClassForm: () => void;
  saving: boolean;
  onDeleteClass: (slug: string) => void;
}

function TaxClassesTab({
  taxClasses,
  taxRates,
  loadData,
  loading,
  showClassForm,
  onShowClassForm,
  newClassName,
  onNewClassNameChange,
  onCreateClass,
  onCancelClassForm,
  saving,
  onDeleteClass,
}: TaxClassesTabProps): React.ReactElement {
  return (
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
          onClick={() => onShowClassForm(true)}
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
              onChange={(e) => onNewClassNameChange(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white text-sm focus:ring-2 focus:ring-blue-500"
              placeholder="e.g., Reduced Rate, Zero Rate"
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onCreateClass}
              disabled={saving}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Create'}
            </button>
            <button
              onClick={onCancelClassForm}
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
          onAction={() => onShowClassForm(true)}
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
                          onClick={() => onDeleteClass(tc.slug)}
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
  );
}

export default TaxClassesTab;
