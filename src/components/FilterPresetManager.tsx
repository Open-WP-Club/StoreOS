import React, { useState } from 'react';
import { Save, Star, Trash2, X } from 'lucide-react';
import { useStoreConfig, useSearch } from '../stores';
import type { FilterPreset } from '../types';

type FilterType = 'products' | 'orders';

interface FilterPresetManagerProps {
  type: FilterType;
  currentFilters: Record<string, unknown>;
  onApplyPreset?: (filters: Record<string, unknown>) => void;
  onSaveSuccess?: (preset: FilterPreset) => void;
}

/**
 * FilterPresetManager - Manage saved filter presets
 */
function FilterPresetManager({
  type,
  currentFilters,
  onApplyPreset,
  onSaveSuccess,
}: FilterPresetManagerProps): React.ReactElement {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [showSaveModal, setShowSaveModal] = useState<boolean>(false);
  const [presetName, setPresetName] = useState<string>('');
  const [saveAsGlobal, setSaveAsGlobal] = useState<boolean>(false);

  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const getFilterPresetsForType = useSearch((state) => state.getFilterPresetsForType);
  const addFilterPreset = useSearch((state) => state.addFilterPreset);
  const deleteFilterPreset = useSearch((state) => state.deleteFilterPreset);

  const currentStore = getCurrentStore();
  const presets = getFilterPresetsForType(type, currentStore?.id ?? null);

  const handleSavePreset = (): void => {
    if (!presetName.trim()) return;

    const preset = addFilterPreset({
      name: presetName.trim(),
      type,
      filters: currentFilters,
      storeId: saveAsGlobal ? 'all' : (currentStore?.id ?? null),
    });

    setPresetName('');
    setSaveAsGlobal(false);
    setShowSaveModal(false);
    setIsOpen(false);

    if (onSaveSuccess) {
      onSaveSuccess(preset);
    }
  };

  const handleApplyPreset = (preset: FilterPreset): void => {
    if (onApplyPreset) {
      onApplyPreset(preset.filters);
    }
    setIsOpen(false);
  };

  const handleDeletePreset = (presetId: string): void => {
    if (window.confirm('Delete this filter preset?')) {
      deleteFilterPreset(presetId);
    }
  };

  // Check if there are any active filters
  const hasActiveFilters =
    currentFilters &&
    Object.keys(currentFilters).some((key) => {
      const value = currentFilters[key];
      return value !== undefined && value !== null && value !== '' && value !== 'all';
    });

  return (
    <div className="relative">
      {/* Main Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 transition-colors"
        title="Manage filter presets"
      >
        <Star className="w-4 h-4" />
        <span>Presets</span>
        {presets.length > 0 && (
          <span className="bg-purple-500 px-1.5 py-0.5 rounded-full text-xs">{presets.length}</span>
        )}
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div
            role="button"
            tabIndex={0}
            aria-label="Close menu"
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
            onKeyDown={(e) => e.key === 'Escape' && setIsOpen(false)}
          />
          <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 z-50">
            <div className="p-3 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
                  Filter Presets
                </h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="max-h-64 overflow-y-auto">
              {presets.length === 0 ? (
                <div className="p-4 text-center text-sm text-gray-500 dark:text-gray-400">
                  No saved presets yet
                </div>
              ) : (
                <div className="py-1">
                  {presets.map((preset) => (
                    <div
                      key={preset.id}
                      className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors group"
                    >
                      <button
                        onClick={() => handleApplyPreset(preset)}
                        className="flex-1 text-left min-w-0"
                      >
                        <div className="flex items-center gap-2">
                          <Star className="w-3 h-3 text-purple-500 flex-shrink-0" />
                          <span className="text-sm text-gray-900 dark:text-white truncate">
                            {preset.name}
                          </span>
                          {preset.storeId === 'all' && (
                            <span className="text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded">
                              Global
                            </span>
                          )}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                          {Object.keys(preset.filters).length} filter
                          {Object.keys(preset.filters).length !== 1 ? 's' : ''}
                        </div>
                      </button>
                      <button
                        onClick={() => handleDeletePreset(preset.id)}
                        className="ml-2 text-gray-400 hover:text-red-600 dark:hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Save Current Filters Button */}
            <div className="p-3 border-t border-gray-200 dark:border-gray-700">
              <button
                onClick={() => {
                  setShowSaveModal(true);
                  setIsOpen(false);
                }}
                disabled={!hasActiveFilters}
                className={`w-full flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm transition-colors ${
                  hasActiveFilters
                    ? 'bg-purple-600 text-white hover:bg-purple-700'
                    : 'bg-gray-200 dark:bg-gray-700 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Save className="w-4 h-4" />
                Save Current Filters
              </button>
            </div>
          </div>
        </>
      )}

      {/* Save Modal */}
      {showSaveModal && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="flex min-h-screen items-center justify-center p-4">
            <div
              role="button"
              tabIndex={0}
              aria-label="Close modal"
              className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
              onClick={() => setShowSaveModal(false)}
              onKeyDown={(e) => e.key === 'Escape' && setShowSaveModal(false)}
            />
            <div className="relative w-full max-w-md bg-white dark:bg-gray-800 rounded-lg shadow-xl">
              <div className="p-6">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Save Filter Preset
                </h3>

                <div className="space-y-4">
                  <div>
                    <label
                      htmlFor="preset-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1"
                    >
                      Preset Name
                    </label>
                    <input
                      id="preset-name"
                      type="text"
                      value={presetName}
                      onChange={(e) => setPresetName(e.target.value)}
                      placeholder="e.g., Low Stock Products"
                      className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-purple-500 focus:border-purple-500"
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="saveAsGlobal"
                      checked={saveAsGlobal}
                      onChange={(e) => setSaveAsGlobal(e.target.checked)}
                      className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                    />
                    <label
                      htmlFor="saveAsGlobal"
                      className="text-sm text-gray-700 dark:text-gray-300"
                    >
                      Available for all stores
                    </label>
                  </div>

                  <div className="bg-gray-50 dark:bg-gray-700 rounded-md p-3">
                    <p className="text-xs text-gray-600 dark:text-gray-400">
                      <strong>Active Filters:</strong>
                    </p>
                    <ul className="mt-1 text-xs text-gray-500 dark:text-gray-400 space-y-0.5">
                      {Object.entries(currentFilters || {}).map(([key, value]) => {
                        if (value && value !== 'all') {
                          return (
                            <li key={key}>
                              &bull; {key}: {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            </li>
                          );
                        }
                        return null;
                      })}
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3 mt-6">
                  <button
                    onClick={handleSavePreset}
                    disabled={!presetName.trim()}
                    className="flex-1 px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
                  >
                    Save Preset
                  </button>
                  <button
                    onClick={() => {
                      setShowSaveModal(false);
                      setPresetName('');
                      setSaveAsGlobal(false);
                    }}
                    className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default FilterPresetManager;
