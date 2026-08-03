import React, { useState, useMemo } from 'react';
import {
  Clock,
  Filter,
  Trash2,
  ShoppingCart,
  Package,
  Tag,
  Store,
  Settings,
  Search,
  ChevronDown,
  ArrowUpDown,
} from 'lucide-react';
import { useActivityLog, useStoreConfig, useShallow } from '../stores';
import type { ActivityEntityType, ActivityLogEntry } from '../types';

const ENTITY_TYPE_OPTIONS: { value: ActivityEntityType | 'all'; label: string }[] = [
  { value: 'all', label: 'All Types' },
  { value: 'order', label: 'Orders' },
  { value: 'product', label: 'Products' },
  { value: 'coupon', label: 'Coupons' },
  { value: 'store', label: 'Stores' },
  { value: 'system', label: 'System' },
];

const ICON_MAP: Record<ActivityEntityType, React.ElementType> = {
  order: ShoppingCart,
  product: Package,
  coupon: Tag,
  store: Store,
  system: Settings,
};

const COLOR_MAP: Record<ActivityEntityType, string> = {
  order: 'text-blue-600 dark:text-blue-400 bg-blue-100 dark:bg-blue-900/30',
  product: 'text-green-600 dark:text-green-400 bg-green-100 dark:bg-green-900/30',
  coupon: 'text-purple-600 dark:text-purple-400 bg-purple-100 dark:bg-purple-900/30',
  store: 'text-orange-600 dark:text-orange-400 bg-orange-100 dark:bg-orange-900/30',
  system: 'text-gray-600 dark:text-gray-400 bg-gray-100 dark:bg-gray-900/30',
};

function formatAction(action: string): string {
  return action
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatRelativeTime(timestamp: string): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function formatFullDate(timestamp: string): string {
  return new Date(timestamp).toLocaleString();
}

const PAGE_SIZE = 25;

function ActivityLogPage(): React.ReactElement {
  const { entries, clearLog } = useActivityLog(
    useShallow((state) => ({
      entries: state.entries,
      clearLog: state.clearLog,
    }))
  );
  const stores = useStoreConfig((state) => state.stores);

  const [filterType, setFilterType] = useState<ActivityEntityType | 'all'>('all');
  const [filterStore, setFilterStore] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'newest' | 'oldest'>('newest');
  const [currentPage, setCurrentPage] = useState(1);
  const [showClearConfirm, setShowClearConfirm] = useState(false);

  const filteredEntries = useMemo(() => {
    let result = entries;

    if (filterType !== 'all') {
      result = result.filter((e) => e.entityType === filterType);
    }

    if (filterStore !== 'all') {
      result = result.filter((e) => e.storeId === filterStore);
    }

    if (searchTerm.trim()) {
      const lower = searchTerm.toLowerCase();
      result = result.filter(
        (e) =>
          e.entityName?.toLowerCase().includes(lower) ||
          e.details?.toLowerCase().includes(lower) ||
          e.action.toLowerCase().includes(lower) ||
          String(e.entityId).includes(lower)
      );
    }

    if (sortOrder === 'oldest') {
      result = [...result].reverse();
    }

    return result;
  }, [entries, filterType, filterStore, searchTerm, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredEntries.length / PAGE_SIZE));
  const paginatedEntries = filteredEntries.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  const handleClearLog = (): void => {
    clearLog();
    setShowClearConfirm(false);
    setCurrentPage(1);
  };

  const getStoreName = (storeId: string | null): string => {
    if (!storeId) return 'System';
    const store = stores.find((s) => s.id === storeId);
    return store?.name || 'Unknown Store';
  };

  // Stats
  const todayCount = entries.filter((e) => {
    const date = new Date(e.timestamp);
    const today = new Date();
    return date.toDateString() === today.toDateString();
  }).length;

  const entityCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const entry of entries) {
      counts[entry.entityType] = (counts[entry.entityType] || 0) + 1;
    }
    return counts;
  }, [entries]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white flex items-center gap-2">
            <Clock className="w-6 h-6" />
            Activity Log
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Track all changes made across your stores
          </p>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
              Clear Log
            </button>
          )}
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-gray-900 dark:text-white">{entries.length}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Total Activities</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{todayCount}</div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Today</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-green-600 dark:text-green-400">
            {entityCounts['order'] || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Order Changes</div>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg p-4 border border-gray-200 dark:border-gray-700">
          <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
            {entityCounts['product'] || 0}
          </div>
          <div className="text-xs text-gray-500 dark:text-gray-400">Product Changes</div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700 p-4 mb-6">
        <div className="flex flex-wrap items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search activities..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Type Filter */}
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <select
              value={filterType}
              onChange={(e) => {
                setFilterType(e.target.value as ActivityEntityType | 'all');
                setCurrentPage(1);
              }}
              className="pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none cursor-pointer"
            >
              {ENTITY_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Store Filter */}
          {stores.length > 1 && (
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <select
                value={filterStore}
                onChange={(e) => {
                  setFilterStore(e.target.value);
                  setCurrentPage(1);
                }}
                className="pl-9 pr-8 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white appearance-none cursor-pointer"
              >
                <option value="all">All Stores</option>
                {stores.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          {/* Sort Toggle */}
          <button
            onClick={() => setSortOrder((prev) => (prev === 'newest' ? 'oldest' : 'newest'))}
            className="flex items-center gap-1.5 px-3 py-2 text-sm border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortOrder === 'newest' ? 'Newest First' : 'Oldest First'}
          </button>
        </div>
      </div>

      {/* Activity List */}
      <div className="bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
        {paginatedEntries.length === 0 ? (
          <div className="py-16 text-center">
            <Clock className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              {entries.length === 0
                ? 'No activity recorded yet. Actions you take will appear here.'
                : 'No activities match your filters.'}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100 dark:divide-gray-700">
            {paginatedEntries.map((entry) => (
              <ActivityRow key={entry.id} entry={entry} storeName={getStoreName(entry.storeId)} />
            ))}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400">
              Showing {(currentPage - 1) * PAGE_SIZE + 1}-
              {Math.min(currentPage * PAGE_SIZE, filteredEntries.length)} of{' '}
              {filteredEntries.length}
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Previous
              </button>
              <span className="px-3 py-1 text-sm text-gray-600 dark:text-gray-400">
                {currentPage} / {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm rounded border border-gray-300 dark:border-gray-600 disabled:opacity-50 disabled:cursor-not-allowed hover:bg-gray-50 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Clear Confirm Modal */}
      {showClearConfirm && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl p-6 max-w-sm w-full">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Clear Activity Log?
            </h3>
            <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
              This will permanently delete all {entries.length} activity entries. This action cannot
              be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowClearConfirm(false)}
                className="px-4 py-2 text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleClearLog}
                className="px-4 py-2 text-sm bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Clear All
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  entry,
  storeName,
}: {
  entry: ActivityLogEntry;
  storeName: string;
}): React.ReactElement {
  const [expanded, setExpanded] = useState(false);
  const Icon = ICON_MAP[entry.entityType] || Settings;
  const colorClass = COLOR_MAP[entry.entityType] || COLOR_MAP.system;

  return (
    <div
      className="px-4 py-3 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors cursor-pointer"
      onClick={() => setExpanded(!expanded)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setExpanded(!expanded);
        }
      }}
      role="button"
      tabIndex={0}
      aria-expanded={expanded}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={`p-2 rounded-lg flex-shrink-0 ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-gray-900 dark:text-white">
              {formatAction(entry.action)}
            </span>
            {entry.entityId && (
              <span className="text-xs text-gray-500 dark:text-gray-400">#{entry.entityId}</span>
            )}
          </div>
          <div className="text-sm text-gray-600 dark:text-gray-300 mt-0.5">
            {entry.entityName && <span className="font-medium">{entry.entityName}</span>}
            {entry.details && (
              <span className={entry.entityName ? ' — ' : ''}>{entry.details}</span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1">
            <span
              className="text-xs text-gray-400 dark:text-gray-500"
              title={formatFullDate(entry.timestamp)}
            >
              {formatRelativeTime(entry.timestamp)}
            </span>
            <span className="text-xs text-gray-400 dark:text-gray-500">{storeName}</span>
          </div>

          {/* Expanded: show changes */}
          {expanded && entry.changes && Object.keys(entry.changes).length > 0 && (
            <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-900 rounded text-xs space-y-1">
              {Object.entries(entry.changes).map(([field, change]) => (
                <div key={field} className="flex items-center gap-2">
                  <span className="text-gray-500 dark:text-gray-400 font-medium">{field}:</span>
                  <span className="text-red-500 dark:text-red-400 line-through">
                    {String(change.from || '—')}
                  </span>
                  <span className="text-gray-400">&rarr;</span>
                  <span className="text-green-600 dark:text-green-400">
                    {String(change.to || '—')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ActivityLogPage;
