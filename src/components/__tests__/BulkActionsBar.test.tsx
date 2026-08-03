import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BulkActionsBar from '../BulkActionsBar';
import { createMockOrder } from '../../__test_utils__/mockFactories';

function createOrders(count: number) {
  return Array.from({ length: count }, (_, i) =>
    createMockOrder({
      id: i + 1,
      total: '50.00',
      currency_symbol: '€',
    })
  );
}

const defaultProps = {
  selectedCount: 3,
  selectedOrders: createOrders(3),
  onStatusChange: vi.fn(() => Promise.resolve()),
  onExport: vi.fn(),
  onClearSelection: vi.fn(),
};

function renderBar(overrides = {}) {
  return render(<BulkActionsBar {...defaultProps} {...overrides} />);
}

describe('BulkActionsBar', () => {
  describe('selection info', () => {
    it('shows selected count (plural)', () => {
      renderBar({ selectedCount: 3 });
      expect(screen.getByText('3 поръчки')).toBeInTheDocument();
    });

    it('shows singular form for 1 item', () => {
      renderBar({ selectedCount: 1, selectedOrders: createOrders(1) });
      expect(screen.getByText('1 поръчка')).toBeInTheDocument();
    });

    it('displays total value', () => {
      renderBar();
      // 3 orders * 50.00 = 150.00
      expect(screen.getByText('Общо: 150.00 €')).toBeInTheDocument();
    });
  });

  describe('status change', () => {
    it('opens status dropdown when button clicked', () => {
      renderBar();
      fireEvent.click(screen.getByText('Смени статус').closest('button')!);
      expect(screen.getByText('Избери нов статус')).toBeInTheDocument();
    });

    it('shows all 7 order statuses', () => {
      renderBar();
      fireEvent.click(screen.getByText('Смени статус').closest('button')!);
      expect(screen.getByText('Pending Payment')).toBeInTheDocument();
      expect(screen.getByText('Processing')).toBeInTheDocument();
      expect(screen.getByText('On Hold')).toBeInTheDocument();
      expect(screen.getByText('Completed')).toBeInTheDocument();
      expect(screen.getByText('Cancelled')).toBeInTheDocument();
      expect(screen.getByText('Refunded')).toBeInTheDocument();
      expect(screen.getByText('Failed')).toBeInTheDocument();
    });

    it('calls onStatusChange when Apply clicked', () => {
      const onStatusChange = vi.fn(() => Promise.resolve());
      renderBar({ onStatusChange });
      fireEvent.click(screen.getByText('Смени статус').closest('button')!);
      // Default selectedStatus is 'processing'
      fireEvent.click(screen.getByText('Приложи'));
      expect(onStatusChange).toHaveBeenCalledWith('processing');
    });

    it('allows selecting different status', () => {
      const onStatusChange = vi.fn(() => Promise.resolve());
      renderBar({ onStatusChange });
      fireEvent.click(screen.getByText('Смени статус').closest('button')!);
      fireEvent.click(screen.getByText('Completed'));
      fireEvent.click(screen.getByText('Приложи'));
      expect(onStatusChange).toHaveBeenCalledWith('completed');
    });
  });

  describe('export', () => {
    it('calls onExport when export button clicked', () => {
      const onExport = vi.fn();
      renderBar({ onExport });
      fireEvent.click(screen.getByTitle('Експорт в CSV'));
      expect(onExport).toHaveBeenCalled();
    });
  });

  describe('print labels', () => {
    it('shows print button when onPrintLabels provided', () => {
      renderBar({ onPrintLabels: vi.fn() });
      expect(screen.getByTitle('Печат етикети')).toBeInTheDocument();
    });

    it('hides print button when onPrintLabels not provided', () => {
      renderBar();
      expect(screen.queryByTitle('Печат етикети')).not.toBeInTheDocument();
    });

    it('calls onPrintLabels when clicked', () => {
      const onPrintLabels = vi.fn();
      renderBar({ onPrintLabels });
      fireEvent.click(screen.getByTitle('Печат етикети'));
      expect(onPrintLabels).toHaveBeenCalled();
    });
  });

  describe('delete', () => {
    it('shows delete button when onDelete provided', () => {
      renderBar({ onDelete: vi.fn(() => Promise.resolve()) });
      expect(screen.getByTitle('Изтрий избраните')).toBeInTheDocument();
    });

    it('hides delete button when onDelete not provided', () => {
      renderBar();
      expect(screen.queryByTitle('Изтрий избраните')).not.toBeInTheDocument();
    });

    it('shows confirmation before deleting', () => {
      renderBar({ onDelete: vi.fn(() => Promise.resolve()) });
      fireEvent.click(screen.getByTitle('Изтрий избраните'));
      expect(screen.getByText(/Изтриване на 3 поръчки/)).toBeInTheDocument();
      expect(screen.getByText('Това действие не може да бъде отменено.')).toBeInTheDocument();
    });

    it('calls onDelete after confirmation', () => {
      const onDelete = vi.fn(() => Promise.resolve());
      renderBar({ onDelete });
      fireEvent.click(screen.getByTitle('Изтрий избраните'));
      fireEvent.click(screen.getByText('Изтрий'));
      expect(onDelete).toHaveBeenCalled();
    });

    it('closes confirmation on cancel', () => {
      renderBar({ onDelete: vi.fn(() => Promise.resolve()) });
      fireEvent.click(screen.getByTitle('Изтрий избраните'));
      expect(screen.getByText(/Изтриване на 3 поръчки/)).toBeInTheDocument();
      fireEvent.click(screen.getByText('Отказ'));
      expect(screen.queryByText(/Изтриване на 3 поръчки/)).not.toBeInTheDocument();
    });
  });

  describe('clear selection', () => {
    it('calls onClearSelection when X clicked', () => {
      const onClearSelection = vi.fn();
      renderBar({ onClearSelection });
      fireEvent.click(screen.getByTitle('Изчисти селекцията'));
      expect(onClearSelection).toHaveBeenCalled();
    });
  });

  describe('processing state', () => {
    it('disables buttons when isProcessing', () => {
      renderBar({ isProcessing: true, onDelete: vi.fn(() => Promise.resolve()) });
      expect(screen.getByTitle('Експорт в CSV')).toBeDisabled();
      expect(screen.getByTitle('Изтрий избраните')).toBeDisabled();
    });
  });

  describe('backdrop', () => {
    it('closes dropdown when backdrop clicked', () => {
      renderBar();
      fireEvent.click(screen.getByText('Смени статус').closest('button')!);
      expect(screen.getByText('Избери нов статус')).toBeInTheDocument();

      // Click the backdrop overlay
      const backdrop = screen.getByRole('presentation');
      fireEvent.click(backdrop);
      expect(screen.queryByText('Избери нов статус')).not.toBeInTheDocument();
    });
  });
});
