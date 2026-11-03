import React, { useState } from 'react';
import { ArrowDown, ArrowUp, Columns3 } from 'lucide-react';
import { nextSort, toggleHidden } from '../utils/listView';
import type { SortState } from '../types';

interface SortableThProps {
  label: string;
  sortKey: string;
  sort: SortState | null;
  onSort: (s: SortState | null) => void;
  className?: string;
}

export function SortableTh({
  label,
  sortKey,
  sort,
  onSort,
  className = '',
}: SortableThProps): React.ReactElement {
  const active = sort?.key === sortKey ? sort : null;
  return (
    <th
      className={`px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider ${className}`}
      aria-sort={active ? (active.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <button
        type="button"
        onClick={() => onSort(nextSort(sort, sortKey))}
        className="inline-flex items-center gap-1 uppercase tracking-wider hover:text-gray-900 dark:hover:text-white"
      >
        {label}
        {active &&
          (active.dir === 'asc' ? (
            <ArrowUp className="w-3 h-3" aria-label="ascending" />
          ) : (
            <ArrowDown className="w-3 h-3" aria-label="descending" />
          ))}
      </button>
    </th>
  );
}

interface ColumnsMenuProps {
  columns: ReadonlyArray<{ key: string; label: string }>;
  hidden: string[];
  onChange: (hidden: string[]) => void;
}

export function ColumnsMenu({ columns, hidden, onChange }: ColumnsMenuProps): React.ReactElement {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600"
      >
        <Columns3 className="w-4 h-4" />
        Columns
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 min-w-[160px] bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-md shadow-lg p-2">
          {columns.map((c) => (
            <label
              key={c.key}
              className="flex items-center gap-2 px-2 py-1 text-sm text-gray-700 dark:text-gray-200"
            >
              <input
                type="checkbox"
                checked={!hidden.includes(c.key)}
                onChange={() => onChange(toggleHidden(hidden, c.key))}
              />
              {c.label}
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
