import { vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import OrdersPage from '../OrdersPage';

// Mock stores
vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
  useSettings: vi.fn(),
  useActivityLog: vi.fn(),
}));

// Mock services
vi.mock('../../services/woocommerce');

// Mock hooks
const { showToast } = vi.hoisted(() => ({ showToast: vi.fn() }));
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], showToast, removeToast: vi.fn() }),
}));

vi.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: () => ({
    loadingState: { isLoading: false, progress: 0 },
  }),
}));

// Mock components
vi.mock('../../components/Pagination', () => ({
  default: function MockPagination({ currentPage, totalItems, onPageChange }) {
    return (
      <div data-testid="pagination">
        <span>Page {currentPage}</span>
        <span>Total: {totalItems}</span>
        <button onClick={() => onPageChange(currentPage + 1)}>Next</button>
      </div>
    );
  },
}));

vi.mock('../../components/FilterPresetManager', () => ({
  default: function MockFilterPresetManager() {
    return <div data-testid="filter-preset-manager">Filter Presets</div>;
  },
}));

vi.mock('../../components/ToastContainer', () => ({
  default: function MockToastContainer() {
    return <div data-testid="toast-container" />;
  },
}));

vi.mock('../../components/LoadingIndicator', () => ({
  default: function MockLoadingIndicator() {
    return <div data-testid="loading-indicator" />;
  },
}));

vi.mock('../../components/BulkActionsBar', () => ({
  default: function MockBulkActionsBar({ onStatusChange, onDelete }) {
    return (
      <div data-testid="bulk-actions-bar">
        <button onClick={() => onStatusChange('completed')}>Set completed</button>
        <button onClick={() => onDelete()}>Delete orders</button>
      </div>
    );
  },
}));

vi.mock('../../components/OrderTableRow', () => ({
  default: function MockOrderTableRow({ order, isSelected, onSelect }) {
    return (
      <tr data-testid={`order-row-${order.id}`}>
        <td>
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => onSelect(order.id)}
            data-testid={`order-checkbox-${order.id}`}
          />
        </td>
        <td>#{order.id}</td>
        <td>
          {order.billing?.first_name} {order.billing?.last_name}
        </td>
        <td>{order.status}</td>
        <td>{order.total}</td>
      </tr>
    );
  },
}));

vi.mock('../../components/StatCard', () => ({
  default: function MockStatCard({ label, value }) {
    return (
      <div data-testid={`stat-card-${label.toLowerCase().replace(/\s+/g, '-')}`}>
        <span>{label}</span>
        <span>{value}</span>
      </div>
    );
  },
}));

vi.mock('../../components/PageHeader', () => ({
  default: function MockPageHeader({ title, subtitle }) {
    return (
      <div data-testid="page-header">
        <h2>{title}</h2>
        {subtitle && <p>{subtitle}</p>}
      </div>
    );
  },
}));

vi.mock('../../components/EmptyState', () => ({
  default: function MockEmptyState({ title, message }) {
    return (
      <div data-testid="empty-state">
        <h3>{title}</h3>
        <p>{message}</p>
      </div>
    );
  },
}));

// Import mocks
import { useStoreConfig, useCache, useSettings, useActivityLog } from '../../stores';
import WooCommerceService from '../../services/woocommerce';

const mockOrders = [
  {
    id: 1001,
    status: 'processing',
    date_created: '2024-01-15T10:30:00',
    total: '150.00',
    currency: 'USD',
    billing: {
      first_name: 'John',
      last_name: 'Doe',
      email: 'john@example.com',
    },
    line_items: [{ name: 'Product A', quantity: 2 }],
    payment_method_title: 'Credit Card',
  },
  {
    id: 1002,
    status: 'pending',
    date_created: '2024-01-14T09:00:00',
    total: '75.00',
    currency: 'USD',
    billing: {
      first_name: 'Jane',
      last_name: 'Smith',
      email: 'jane@example.com',
    },
    line_items: [{ name: 'Product B', quantity: 1 }],
    payment_method_title: 'PayPal',
  },
  {
    id: 1003,
    status: 'completed',
    date_created: '2024-01-13T14:00:00',
    total: '200.00',
    currency: 'USD',
    billing: {
      first_name: 'Bob',
      last_name: 'Johnson',
      email: 'bob@example.com',
    },
    line_items: [{ name: 'Product C', quantity: 3 }],
    payment_method_title: 'Bank Transfer',
  },
];

const mockStore = {
  id: 'store-1',
  name: 'Test Store',
  url: 'https://test.com',
  consumerKey: 'ck_test',
  consumerSecret: 'cs_test',
};
const setCachedData = vi.fn();
const batchOrders = vi.fn();

describe('OrdersPage bulk operations', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useStoreConfig.mockReturnValue(vi.fn(() => mockStore));
    useSettings.mockReturnValue(vi.fn());
    useActivityLog.mockImplementation((selector) => selector({ logActivity: vi.fn() }));
    useCache.mockImplementation((selector) =>
      selector({ setCachedData, cache: { orders: { data: mockOrders } } })
    );
    WooCommerceService.mockImplementation(function () {
      return { batchOrders };
    });
  });

  const selectTwoAnd = async (user, label) => {
    render(
      <MemoryRouter>
        <OrdersPage />
      </MemoryRouter>
    );
    await user.click(screen.getByTestId('order-checkbox-1001'));
    await user.click(screen.getByTestId('order-checkbox-1002'));
    await user.click(screen.getByText(label));
  };

  it('bulk status update sends one batch call and toasts success', async () => {
    batchOrders.mockResolvedValue({
      success: true,
      data: { update: [{ id: 1001 }, { id: 1002 }] },
    });
    await selectTwoAnd(userEvent.setup(), 'Set completed');
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(batchOrders).toHaveBeenCalledWith({
      update: [
        { id: 1001, status: 'completed' },
        { id: 1002, status: 'completed' },
      ],
    });
    expect(showToast.mock.calls[0][1]).toBe('success');
  });

  it('bulk status update reports partial failure', async () => {
    batchOrders.mockResolvedValue({
      success: true,
      data: { update: [{ id: 1001 }, { id: 1002, error: { code: 'x', message: 'nope' } }] },
    });
    await selectTwoAnd(userEvent.setup(), 'Set completed');
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(showToast.mock.calls[0][0]).toContain('1 от 2');
    expect(showToast.mock.calls[0][1]).toBe('warning');
    // Only the succeeded order is written to the cache
    const cached = setCachedData.mock.calls[0][1];
    expect(cached.find((o) => o.id === 1001).status).toBe('completed');
    expect(cached.find((o) => o.id === 1002).status).toBe('pending');
  });

  it('bulk status update shows error when every item fails', async () => {
    batchOrders.mockResolvedValue({
      success: true,
      data: {
        update: [
          { id: 1001, error: {} },
          { id: 1002, error: {} },
        ],
      },
    });
    await selectTwoAnd(userEvent.setup(), 'Set completed');
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(showToast.mock.calls[0][1]).toBe('error');
    expect(setCachedData).not.toHaveBeenCalled();
  });

  it('undo restores previous statuses via batch and reports partial undo failure', async () => {
    batchOrders
      .mockResolvedValueOnce({ success: true, data: { update: [{ id: 1001 }, { id: 1002 }] } })
      .mockResolvedValueOnce({
        success: true,
        data: { update: [{ id: 1001 }, { id: 1002, error: {} }] },
      });
    await selectTwoAnd(userEvent.setup(), 'Set completed');
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    const action = showToast.mock.calls[0][3];
    await action.onClick();
    expect(batchOrders).toHaveBeenLastCalledWith({
      update: [
        { id: 1001, status: 'processing' },
        { id: 1002, status: 'pending' },
      ],
    });
    expect(showToast).toHaveBeenLastCalledWith(expect.stringContaining('1 от 2'), 'warning');
  });

  it('bulk delete uses batch delete and removes deleted orders from cache', async () => {
    batchOrders.mockResolvedValue({
      success: true,
      data: { delete: [{ id: 1001 }, { id: 1002 }] },
    });
    await selectTwoAnd(userEvent.setup(), 'Delete orders');
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(batchOrders).toHaveBeenCalledWith({ delete: [1001, 1002] });
    expect(setCachedData.mock.calls[0][1].map((o) => o.id)).toEqual([1003]);
    expect(showToast.mock.calls[0][1]).toBe('success');
  });

  it('bulk delete reports partial failure and keeps failed order', async () => {
    batchOrders.mockResolvedValue({
      success: true,
      data: { delete: [{ id: 1001 }, { id: 1002, error: { message: 'locked' } }] },
    });
    await selectTwoAnd(userEvent.setup(), 'Delete orders');
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(showToast.mock.calls[0][0]).toContain('1 от 2');
    expect(showToast.mock.calls[0][1]).toBe('warning');
    expect(setCachedData.mock.calls[0][1].map((o) => o.id)).toEqual([1002, 1003]);
  });

  it('bulk delete shows error when the request fails', async () => {
    batchOrders.mockResolvedValue({ success: false, error: 'boom' });
    await selectTwoAnd(userEvent.setup(), 'Delete orders');
    await waitFor(() => expect(showToast).toHaveBeenCalled());
    expect(showToast.mock.calls[0][1]).toBe('error');
    expect(setCachedData).not.toHaveBeenCalled();
  });
});
