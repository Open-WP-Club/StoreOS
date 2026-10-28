import { vi, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewsPage from '../ReviewsPage';
import { createMockStore } from '../../__test_utils__';
import { useStoreConfig, useCache } from '../../stores';

const { mockGetAllReviews, mockUpdateReview, mockDeleteReview, mockBatchUpdateReviews, MockWooCommerceService } = vi.hoisted(() => ({
  mockGetAllReviews: vi.fn(),
  mockUpdateReview: vi.fn(),
  mockDeleteReview: vi.fn(),
  mockBatchUpdateReviews: vi.fn(),
  MockWooCommerceService: vi.fn(),
}));

vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
}));

vi.mock('../../services/woocommerce', () => ({
  __esModule: true,
  default: MockWooCommerceService,
}));

vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({
    toasts: [],
    showToast: vi.fn(),
    removeToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: () => ({
    loadingState: { isLoading: false, progress: 0 },
  }),
}));

vi.mock('../../utils/csvExport', () => ({
  exportToCSV: vi.fn(),
}));

vi.mock('../../utils/pdfExport', () => ({
  exportTableToPDF: vi.fn(() => Promise.resolve()),
}));

vi.mock('../../components/ExportMenu', () => ({
  default: function MockExportMenu() {
    return <div data-testid="export-menu">Export</div>;
  },
}));

vi.mock('../../components/Pagination', () => ({
  default: function MockPagination() {
    return <div data-testid="pagination">Pagination</div>;
  },
}));

vi.mock('../../components/ToastContainer', () => ({
  default: function MockToastContainer() {
    return <div data-testid="toast-container" />;
  },
}));

vi.mock('../../components/LoadingIndicator', () => ({
  default: function MockLoadingIndicator() {
    return <div data-testid="loading-indicator">Loading...</div>;
  },
}));

vi.mock('../../components/StatCard', () => ({
  default: function MockStatCard({ label }: { label: string }) {
    return <div data-testid={`stat-${label}`}>{label}</div>;
  },
}));

vi.mock('../../components/PageHeader', () => ({
  default: function MockPageHeader({ title }: { title: string }) {
    return <h1 data-testid="page-header">{title}</h1>;
  },
}));

vi.mock('../../components/EmptyState', () => ({
  default: function MockEmptyState({ message }: { message: string }) {
    return <div data-testid="empty-state">{message}</div>;
  },
}));

vi.mock('../../components/ConfirmDialog', () => ({
  default: function MockConfirmDialog({
    isOpen,
    onConfirm,
    onCancel,
  }: {
    isOpen: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }) {
    if (!isOpen) return null;
    return (
      <div data-testid="confirm-dialog">
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    );
  },
}));

const mockReviews = [
  {
    id: 1,
    date_created: '2025-06-01T10:00:00',
    date_created_gmt: '2025-06-01T10:00:00',
    product_id: 42,
    product_name: 'Test Product',
    product_permalink: 'https://example.com/product/test',
    status: 'approved',
    reviewer: 'John Doe',
    reviewer_email: 'john@example.com',
    review: '<p>Great product!</p>',
    rating: 5,
    verified: true,
  },
  {
    id: 2,
    date_created: '2025-06-02T10:00:00',
    date_created_gmt: '2025-06-02T10:00:00',
    product_id: 43,
    product_name: 'Another Product',
    product_permalink: 'https://example.com/product/another',
    status: 'hold',
    reviewer: 'Jane Smith',
    reviewer_email: 'jane@example.com',
    review: '<p>Not bad</p>',
    rating: 3,
    verified: false,
  },
  {
    id: 3,
    date_created: '2025-06-03T10:00:00',
    date_created_gmt: '2025-06-03T10:00:00',
    product_id: 42,
    product_name: 'Test Product',
    product_permalink: 'https://example.com/product/test',
    status: 'spam',
    reviewer: 'Spammer',
    reviewer_email: 'spam@example.com',
    review: '<p>Buy cheap stuff here</p>',
    rating: 1,
    verified: false,
  },
];

describe('ReviewsPage', () => {
  const mockStore = createMockStore();
  const mockGetCachedData = vi.fn();
  const mockSetCachedData = vi.fn();
  const mockClearCacheForType = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();

    mockGetAllReviews.mockResolvedValue({
      success: true,
      data: mockReviews,
    });
    mockUpdateReview.mockResolvedValue({ success: true, data: mockReviews[0] });
    mockDeleteReview.mockResolvedValue({ success: true });
    mockBatchUpdateReviews.mockResolvedValue({ success: true });

    MockWooCommerceService.mockImplementation(function (this: Record<string, unknown>) {
      this.getAllReviews = mockGetAllReviews;
      this.updateReview = mockUpdateReview;
      this.deleteReview = mockDeleteReview;
      this.batchUpdateReviews = mockBatchUpdateReviews;
    });

    mockGetCachedData.mockResolvedValue(null);
    mockSetCachedData.mockResolvedValue(undefined);
    mockClearCacheForType.mockResolvedValue(undefined);

    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => mockStore };
      return selector ? selector(state) : state;
    });

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = {
        getCachedData: mockGetCachedData,
        setCachedData: mockSetCachedData,
        clearCacheForType: mockClearCacheForType,
      };
      return selector ? selector(state) : state;
    });
  });

  it('should render page header', async () => {
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('page-header')).toBeInTheDocument();
    expect(screen.getByText('Reviews')).toBeInTheDocument();

    await waitFor(() => {});
  });

  it('should display reviews after loading', async () => {
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    });
  });

  it('should show empty state when no store is selected', () => {
    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => undefined };
      return selector ? selector(state) : state;
    });

    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(screen.getByTestId('empty-state')).toBeInTheDocument();
  });

  it('should render stat cards', async () => {
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByTestId('stat-Total Reviews')).toBeInTheDocument();
      expect(screen.getByTestId('stat-Approved')).toBeInTheDocument();
      expect(screen.getByTestId('stat-Pending')).toBeInTheDocument();
      expect(screen.getByTestId('stat-Avg Rating')).toBeInTheDocument();
    });
  });

  it('should show loading state initially', () => {
    // Make the API call hang so loading remains true
    mockGetAllReviews.mockReturnValue(new Promise(() => {}));

    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    expect(screen.getByText('Loading reviews...')).toBeInTheDocument();
  });

  it('should display review content with HTML stripped', async () => {
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Great product!')).toBeInTheDocument();
      expect(screen.getByText('Not bad')).toBeInTheDocument();
    });
  });

  it('should show verified badge for verified reviews', async () => {
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const verifiedBadges = screen.getAllByText('Verified');
    expect(verifiedBadges.length).toBeGreaterThan(0);
  });

  it('should show status badges', async () => {
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      // "Approved" and "Pending" appear both in filter dropdown and as badges
      expect(screen.getAllByText('Approved').length).toBeGreaterThanOrEqual(2); // dropdown + badge
      expect(screen.getAllByText('Pending').length).toBeGreaterThanOrEqual(2); // dropdown + badge
      expect(screen.getAllByText('Spam').length).toBeGreaterThanOrEqual(2); // dropdown + badge
    });
  });

  it('should filter reviews by search term', async () => {
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(
      'Search by reviewer, email, product, or content...'
    );
    fireEvent.change(searchInput, { target: { value: 'John' } });

    await waitFor(() => {
      expect(screen.getByText('John Doe')).toBeInTheDocument();
      expect(screen.queryByText('Jane Smith')).not.toBeInTheDocument();
    });
  });

  it('should show Approve All button when pending reviews exist', async () => {
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('Approve All (1)')).toBeInTheDocument();
    });
  });

  it('should show results summary', async () => {
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      const showingText = screen.getByText(/Showing/);
      expect(showingText).toBeInTheDocument();
    });
  });

  it('should handle API error gracefully', async () => {
    mockGetAllReviews.mockResolvedValue({
      success: false,
      error: 'API Error',
    });

    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );

    await waitFor(() => {
      expect(screen.getByText('No reviews found')).toBeInTheDocument();
    });
  });
});
