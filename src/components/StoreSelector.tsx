import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useStoreConfig, useShallow } from '../stores';
import { Plus } from 'lucide-react';

function StoreSelector(): React.ReactElement | null {
  const navigate = useNavigate();

  // useShallow prevents re-renders when unrelated store state changes
  const { stores, currentStoreId, setCurrentStore } = useStoreConfig(
    useShallow((state) => ({
      stores: state.stores,
      currentStoreId: state.currentStoreId,
      setCurrentStore: state.setCurrentStore,
    }))
  );

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>): void => {
    setCurrentStore(e.target.value);
  };

  const handleAddStore = (): void => {
    navigate('/setup');
  };

  if (stores.length === 0) return null;

  return (
    <div className="flex items-center space-x-2">
      <label
        htmlFor="store-selector"
        className="text-sm font-medium text-gray-700 dark:text-gray-300"
      >
        Store:
      </label>
      <select
        id="store-selector"
        value={currentStoreId || ''}
        onChange={handleChange}
        className="block w-48 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 transition-colors"
      >
        {stores.map((store) => (
          <option key={store.id} value={store.id}>
            {store.name} ({new URL(store.url).hostname})
          </option>
        ))}
      </select>
      <button
        onClick={handleAddStore}
        className="p-1.5 rounded text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
        title="Add Store"
        aria-label="Add new store"
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

export default StoreSelector;
