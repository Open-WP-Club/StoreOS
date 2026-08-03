import { vi, Mock } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ActivityLogPage from '../ActivityLogPage';
import { useActivityLog, useStoreConfig, useShallow } from '../../stores';
import { createMockStore } from '../../__test_utils__/mockFactories';
import type { ActivityLogEntry } from '../../types';

vi.mock('../../stores');

const mockClearLog = vi.fn();
let mockEntries: ActivityLogEntry[];
let mockStores: ReturnType<typeof createMockStore>[];

function createEntry(overrides: Partial<ActivityLogEntry> = {}): ActivityLogEntry {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    action: 'order_status_changed',
    entityType: 'order',
    entityId: 1,
    entityName: 'Order #1',
    storeId: 'store-1',
    storeName: 'Test Store',
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  mockStores = [createMockStore({ id: 'store-1', name: 'Test Store' })];
  mockEntries = [];

  // useShallow just passes through the selector
  (useShallow as unknown as Mock).mockImplementation((fn: (state: unknown) => unknown) => fn);

  (useActivityLog as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = {
      entries: mockEntries,
      clearLog: mockClearLog,
    };
    return selector ? selector(state) : state;
  });

  (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = {
      stores: mockStores,
      currentStoreId: 'store-1',
    };
    return selector ? selector(state) : state;
  });
});

describe('ActivityLogPage', () => {
  describe('empty state', () => {
    it('shows empty message when no entries', () => {
      render(<ActivityLogPage />);
      expect(
        screen.getByText('No activity recorded yet. Actions you take will appear here.')
      ).toBeInTheDocument();
    });

    it('shows "Activity Log" heading', () => {
      render(<ActivityLogPage />);
      expect(screen.getByText('Activity Log')).toBeInTheDocument();
    });

    it('does not show Clear Log button when empty', () => {
      render(<ActivityLogPage />);
      expect(screen.queryByText('Clear Log')).not.toBeInTheDocument();
    });
  });

  describe('with entries', () => {
    beforeEach(() => {
      mockEntries = [
        createEntry({
          id: '1',
          action: 'order_status_changed',
          entityType: 'order',
          entityId: 42,
          entityName: 'Order #42',
          timestamp: new Date().toISOString(),
        }),
        createEntry({
          id: '2',
          action: 'product_created',
          entityType: 'product',
          entityId: 10,
          entityName: 'Widget',
          timestamp: new Date(Date.now() - 3600000).toISOString(),
        }),
        createEntry({
          id: '3',
          action: 'coupon_deleted',
          entityType: 'coupon',
          entityId: 5,
          entityName: 'SUMMER20',
          timestamp: new Date(Date.now() - 86400000).toISOString(),
        }),
      ];
    });

    it('renders activity entries', () => {
      render(<ActivityLogPage />);
      expect(screen.getByText('Order Status Changed')).toBeInTheDocument();
      expect(screen.getByText('Product Created')).toBeInTheDocument();
      expect(screen.getByText('Coupon Deleted')).toBeInTheDocument();
    });

    it('renders entity names', () => {
      render(<ActivityLogPage />);
      expect(screen.getByText('Order #42')).toBeInTheDocument();
      expect(screen.getByText('Widget')).toBeInTheDocument();
      expect(screen.getByText('SUMMER20')).toBeInTheDocument();
    });

    it('renders entity IDs', () => {
      render(<ActivityLogPage />);
      expect(screen.getByText('#42')).toBeInTheDocument();
      expect(screen.getByText('#10')).toBeInTheDocument();
      expect(screen.getByText('#5')).toBeInTheDocument();
    });

    it('shows stats cards', () => {
      render(<ActivityLogPage />);
      // Total activities
      expect(screen.getByText('3')).toBeInTheDocument();
      expect(screen.getByText('Total Activities')).toBeInTheDocument();
    });

    it('shows Clear Log button', () => {
      render(<ActivityLogPage />);
      expect(screen.getByText('Clear Log')).toBeInTheDocument();
    });
  });

  describe('filtering', () => {
    beforeEach(() => {
      mockEntries = [
        createEntry({ id: '1', action: 'order_status_changed', entityType: 'order', entityName: 'Order #1' }),
        createEntry({ id: '2', action: 'product_created', entityType: 'product', entityName: 'Widget' }),
        createEntry({ id: '3', action: 'coupon_deleted', entityType: 'coupon', entityName: 'COUPON10' }),
      ];
    });

    it('filters by entity type', () => {
      render(<ActivityLogPage />);

      // Select "Orders" filter
      const typeSelect = screen.getByDisplayValue('All Types');
      fireEvent.change(typeSelect, { target: { value: 'order' } });

      expect(screen.getByText('Order Status Changed')).toBeInTheDocument();
      expect(screen.queryByText('Product Created')).not.toBeInTheDocument();
      expect(screen.queryByText('Coupon Deleted')).not.toBeInTheDocument();
    });

    it('filters by search term', () => {
      render(<ActivityLogPage />);

      const searchInput = screen.getByPlaceholderText('Search activities...');
      fireEvent.change(searchInput, { target: { value: 'Widget' } });

      expect(screen.getByText('Widget')).toBeInTheDocument();
      expect(screen.queryByText('Order #1')).not.toBeInTheDocument();
      expect(screen.queryByText('COUPON10')).not.toBeInTheDocument();
    });

    it('shows no-match message when filter returns empty', () => {
      render(<ActivityLogPage />);

      const searchInput = screen.getByPlaceholderText('Search activities...');
      fireEvent.change(searchInput, { target: { value: 'nonexistent' } });

      expect(screen.getByText('No activities match your filters.')).toBeInTheDocument();
    });
  });

  describe('sort order', () => {
    it('toggles between newest and oldest first', () => {
      mockEntries = [
        createEntry({ id: '1', entityName: 'First', timestamp: '2025-01-01T00:00:00Z' }),
        createEntry({ id: '2', entityName: 'Second', timestamp: '2025-01-02T00:00:00Z' }),
      ];

      render(<ActivityLogPage />);

      // Default is newest first (entries are already stored newest first)
      const sortButton = screen.getByText('Newest First');
      fireEvent.click(sortButton);

      expect(screen.getByText('Oldest First')).toBeInTheDocument();
    });
  });

  describe('clear log', () => {
    it('shows confirmation modal when Clear Log clicked', () => {
      mockEntries = [createEntry({ id: '1' })];

      render(<ActivityLogPage />);
      fireEvent.click(screen.getByText('Clear Log'));

      expect(screen.getByText('Clear Activity Log?')).toBeInTheDocument();
    });

    it('calls clearLog when confirmed', () => {
      mockEntries = [createEntry({ id: '1' })];

      render(<ActivityLogPage />);
      fireEvent.click(screen.getByText('Clear Log'));
      fireEvent.click(screen.getByText('Clear All'));

      expect(mockClearLog).toHaveBeenCalled();
    });

    it('closes modal when cancelled', () => {
      mockEntries = [createEntry({ id: '1' })];

      render(<ActivityLogPage />);
      fireEvent.click(screen.getByText('Clear Log'));
      fireEvent.click(screen.getByText('Cancel'));

      expect(screen.queryByText('Clear Activity Log?')).not.toBeInTheDocument();
    });
  });

  describe('expanded changes', () => {
    it('shows change details when entry is clicked', () => {
      mockEntries = [
        createEntry({
          id: '1',
          action: 'order_status_changed',
          entityType: 'order',
          changes: { status: { from: 'pending', to: 'processing' } },
        }),
      ];

      render(<ActivityLogPage />);

      // Click to expand
      fireEvent.click(screen.getByText('Order Status Changed'));

      expect(screen.getByText('status:')).toBeInTheDocument();
      expect(screen.getByText('pending')).toBeInTheDocument();
      expect(screen.getByText('processing')).toBeInTheDocument();
    });
  });

  describe('multi-store filter', () => {
    it('shows store filter when multiple stores exist', () => {
      mockStores = [
        createMockStore({ id: 'store-1', name: 'Store 1' }),
        createMockStore({ id: 'store-2', name: 'Store 2' }),
      ];

      render(<ActivityLogPage />);
      expect(screen.getByDisplayValue('All Stores')).toBeInTheDocument();
    });

    it('does not show store filter with single store', () => {
      mockStores = [createMockStore({ id: 'store-1', name: 'Store 1' })];

      render(<ActivityLogPage />);
      expect(screen.queryByDisplayValue('All Stores')).not.toBeInTheDocument();
    });
  });
});
