import { vi, Mock } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import ReviewsPage from '../ReviewsPage';
import { createMockStore } from '../../__test_utils__';
import { useStoreConfig } from '../../stores';
import { exportToCSV } from '../../utils/csvExport';
import { exportTableToPDF } from '../../utils/pdfExport';

const m = vi.hoisted(() => ({
  getAllReviews: vi.fn(),
  updateReview: vi.fn(),
  deleteReview: vi.fn(),
  batchUpdateReviews: vi.fn(),
  showToast: vi.fn(),
  Service: vi.fn(),
}));

vi.mock('../../stores', () => ({ useStoreConfig: vi.fn(), useCache: vi.fn() }));
vi.mock('../../services/woocommerce', () => ({ __esModule: true, default: m.Service }));
vi.mock('../../hooks/useToast', () => ({
  useToast: () => ({ toasts: [], showToast: m.showToast, removeToast: vi.fn() }),
}));
vi.mock('../../hooks/useProgressiveLoading', () => ({
  useProgressiveLoading: () => ({ loadingState: { isLoading: false, progress: 0 } }),
}));
vi.mock('../../utils/csvExport', () => ({ exportToCSV: vi.fn() }));
vi.mock('../../utils/pdfExport', () => ({ exportTableToPDF: vi.fn() }));
vi.mock('../../components/ExportMenu', () => ({
  default: ({ onExportCSV, onExportPDF }: { onExportCSV: () => void; onExportPDF: () => void }) => (
    <div>
      <button onClick={onExportCSV}>csv</button>
      <button onClick={onExportPDF}>pdf</button>
    </div>
  ),
}));
vi.mock('../../components/ConfirmDialog', () => ({
  default: ({ isOpen, onConfirm, onCancel }: { isOpen: boolean; onConfirm: () => void; onCancel: () => void }) =>
    isOpen ? (
      <div>
        <button onClick={onConfirm}>Confirm</button>
        <button onClick={onCancel}>Cancel</button>
      </div>
    ) : null,
}));

const rev = (id: number, status: string, rating: number, reviewer: string) => ({
  id,
  date_created: '2025-06-01T10:00:00',
  product_id: 40 + id,
  product_name: `Prod ${id}`,
  product_permalink: `https://example.com/p/${id}`,
  status,
  reviewer,
  reviewer_email: `${reviewer.toLowerCase()}@example.com`,
  review: `<b>Text of ${reviewer}</b>`,
  rating,
  verified: id === 1,
});
const reviews = [
  rev(1, 'approved', 5, 'Alice'),
  rev(2, 'hold', 3, 'Bob'),
  rev(3, 'spam', 1, 'Carol'),
  rev(4, 'hold', 4, 'Dave'),
];

const renderPage = async (): Promise<void> => {
  render(
    <MemoryRouter>
      <ReviewsPage />
    </MemoryRouter>
  );
  await screen.findByText('Alice');
};
const expand = (name: string): void => {
  const card = screen.getByText(name).closest('.shadow-md') as HTMLElement;
  fireEvent.click(card.querySelectorAll('button')[0]!);
};
const names = (): string[] =>
  ['Alice', 'Bob', 'Carol', 'Dave'].filter((n) => screen.queryByText(n));

describe('ReviewsPage actions', () => {
  beforeEach(() => {
    m.getAllReviews.mockResolvedValue({ success: true, data: reviews });
    m.updateReview.mockImplementation(async (id: number, p: { status: string }) => ({
      success: true,
      data: { ...reviews.find((r) => r.id === id)!, ...p },
    }));
    m.deleteReview.mockResolvedValue({ success: true });
    m.batchUpdateReviews.mockResolvedValue({ success: true });
    m.Service.mockImplementation(function (this: Record<string, unknown>) {
      this.getAllReviews = m.getAllReviews;
      this.updateReview = m.updateReview;
      this.deleteReview = m.deleteReview;
      this.batchUpdateReviews = m.batchUpdateReviews;
    });
    const store = createMockStore();
    (useStoreConfig as unknown as Mock).mockImplementation((sel?: (s: unknown) => unknown) => {
      const state = { getCurrentStore: () => store };
      return sel ? sel(state) : state;
    });
  });

  it('shows a toast when the initial load fails', async () => {
    m.getAllReviews.mockResolvedValue({ success: false, error: 'denied' });
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('denied', 'error'));
  });

  it('toasts when the initial load throws', async () => {
    m.getAllReviews.mockRejectedValue(new Error('offline'));
    render(
      <MemoryRouter>
        <ReviewsPage />
      </MemoryRouter>
    );
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('Error: offline', 'error'));
  });

  it('filters by status, rating and sorts by rating', async () => {
    await renderPage();
    const [status, rating, sort] = screen.getAllByRole('combobox');
    fireEvent.change(status!, { target: { value: 'hold' } });
    expect(names()).toEqual(['Bob', 'Dave']);
    fireEvent.change(rating!, { target: { value: '4' } });
    expect(names()).toEqual(['Dave']);
    fireEvent.change(status!, { target: { value: 'all' } });
    fireEvent.change(rating!, { target: { value: 'all' } });
    fireEvent.change(sort!, { target: { value: 'rating_low' } });
    const order = screen.getAllByText(/^(Alice|Bob|Carol|Dave)$/).map((e) => e.textContent);
    expect(order).toEqual(['Carol', 'Bob', 'Dave', 'Alice']);
  });

  it('shows "No reviews found" when filters match nothing', async () => {
    await renderPage();
    fireEvent.change(screen.getByPlaceholderText(/search/i), { target: { value: 'zzzz' } });
    expect(screen.getByText('No reviews found')).toBeInTheDocument();
  });

  it('approves a review and replaces it in the list', async () => {
    await renderPage();
    expand('Bob');
    fireEvent.click(screen.getByText('Approve'));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('Review approved', 'success'));
    expect(m.updateReview).toHaveBeenCalledWith(2, { status: 'approved' });
  });

  it('marks spam and reports API failure without changing state', async () => {
    m.updateReview.mockResolvedValue({ success: false, error: 'nope' });
    await renderPage();
    expand('Bob');
    fireEvent.click(screen.getByText('Mark Spam'));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('nope', 'error'));
    expect(screen.getByText('Mark Spam')).toBeInTheDocument();
  });

  it('unapprove sets to pending; thrown errors toast', async () => {
    await renderPage();
    expand('Alice');
    m.updateReview.mockRejectedValueOnce(new Error('timeout'));
    fireEvent.click(screen.getByText('Unapprove'));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('Error: timeout', 'error'));
    fireEvent.click(screen.getByText('Unapprove'));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('Review set to pending', 'success'));
  });

  it('delete requires confirmation, cancel keeps the review', async () => {
    await renderPage();
    expand('Carol');
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Cancel'));
    expect(m.deleteReview).not.toHaveBeenCalled();
    expect(screen.getByText('Carol')).toBeInTheDocument();
  });

  it('confirmed delete removes the review', async () => {
    await renderPage();
    expand('Carol');
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(screen.queryByText('Carol')).toBeNull());
    expect(m.deleteReview).toHaveBeenCalledWith(3);
    expect(m.showToast).toHaveBeenCalledWith('Review deleted permanently', 'success');
  });

  it('failed delete keeps the review and closes the dialog', async () => {
    m.deleteReview.mockResolvedValue({ success: false, error: 'locked' });
    await renderPage();
    expand('Carol');
    fireEvent.click(screen.getByText('Delete'));
    fireEvent.click(screen.getByText('Confirm'));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('locked', 'error'));
    expect(screen.getByText('Carol')).toBeInTheDocument();
    expect(screen.queryByText('Confirm')).toBeNull();
  });

  it('Approve All batches only pending reviews', async () => {
    await renderPage();
    fireEvent.click(screen.getByText(/Approve All \(2\)/));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('2 reviews approved', 'success'));
    expect(m.batchUpdateReviews).toHaveBeenCalledWith([
      { id: 2, status: 'approved' },
      { id: 4, status: 'approved' },
    ]);
    expect(screen.queryByText(/Approve All/)).toBeNull();
  });

  it('Approve All surfaces batch failure', async () => {
    m.batchUpdateReviews.mockResolvedValue({ success: false, error: 'batch down' });
    await renderPage();
    fireEvent.click(screen.getByText(/Approve All/));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('batch down', 'error'));
    expect(screen.getByText(/Approve All/)).toBeInTheDocument();
  });

  it('Refresh reloads and toasts; failure toasts the error', async () => {
    await renderPage();
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('Reviews refreshed', 'success'));
    m.getAllReviews.mockResolvedValue({ success: false, error: '' });
    fireEvent.click(screen.getByText('Refresh'));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('Failed to refresh reviews', 'error'));
  });

  it('exports CSV with HTML stripped and PDF with the filtered rows', async () => {
    (exportTableToPDF as Mock).mockRejectedValueOnce(new Error('x'));
    await renderPage();
    fireEvent.click(screen.getByText('csv'));
    const rows = (exportToCSV as Mock).mock.calls[0]![0] as { review: string }[];
    expect(rows[0]!.review).toBe('Text of Alice');
    expect((exportToCSV as Mock).mock.calls[0]![2]).toMatch(/^reviews-.*\.csv$/);
    fireEvent.click(screen.getByText('pdf'));
    await waitFor(() => expect(m.showToast).toHaveBeenCalledWith('PDF export failed', 'error'));
    expect((exportTableToPDF as Mock).mock.calls[0]![0]).toHaveLength(4);
  });
});
