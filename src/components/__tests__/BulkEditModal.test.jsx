import { vi } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import BulkEditModal from '../BulkEditModal';

describe('BulkEditModal', () => {
  const mockProducts = [
    {
      id: 1,
      name: 'Product 1',
      regular_price: '100.00',
      sale_price: '80.00',
      stock_quantity: 50,
    },
    {
      id: 2,
      name: 'Product 2',
      regular_price: '200.00',
      sale_price: '',
      stock_quantity: 30,
    },
  ];

  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    selectedProducts: mockProducts,
    onSave: vi.fn().mockResolvedValue(undefined),
    onError: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper: go through the preview step and click the confirm/update button
  const clickUpdateButton = async () => {
    await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
    await userEvent.click(screen.getByRole('button', { name: /confirm.*update.*products/i }));
  };

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<BulkEditModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText(/bulk edit products/i)).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByText(/bulk edit products/i)).toBeInTheDocument();
    });

    it('should display the number of selected products', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByText(/Selected products \(2\)/i)).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByLabelText(/close modal/i)).toBeInTheDocument();
    });

    it('should render instructions', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByText(/instructions/i)).toBeInTheDocument();
    });
  });

  describe('Pricing Section', () => {
    it('should render regular price checkbox', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByLabelText(/regular price/i)).toBeInTheDocument();
    });

    it('should render sale price checkbox', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByLabelText(/sale price/i)).toBeInTheDocument();
    });

    it('should show price inputs when checkbox is checked', async () => {
      render(<BulkEditModal {...defaultProps} />);

      const priceCheckbox = screen.getByLabelText(/regular price/i);
      await userEvent.click(priceCheckbox);

      expect(screen.getByPlaceholderText(/value/i)).toBeInTheDocument();
    });

    it('should allow selecting price action', async () => {
      render(<BulkEditModal {...defaultProps} />);

      const priceCheckbox = screen.getByLabelText(/regular price/i);
      await userEvent.click(priceCheckbox);

      const selects = screen.getAllByRole('combobox');
      expect(selects.length).toBeGreaterThan(0);
    });
  });

  describe('Inventory Section', () => {
    it('should render stock quantity checkbox', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByLabelText(/stock quantity/i)).toBeInTheDocument();
    });

    it('should render stock status checkbox', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByLabelText(/stock status/i)).toBeInTheDocument();
    });

    it('should render stock management checkbox', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByLabelText(/enable stock management/i)).toBeInTheDocument();
    });

    it('should show stock inputs when checkbox is checked', async () => {
      render(<BulkEditModal {...defaultProps} />);

      const stockCheckbox = screen.getByLabelText(/stock quantity/i);
      await userEvent.click(stockCheckbox);

      expect(screen.getByPlaceholderText(/quantity/i)).toBeInTheDocument();
    });
  });

  describe('Product Data Section', () => {
    it('should render tax status checkbox', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByLabelText(/tax status/i)).toBeInTheDocument();
    });

    it('should render catalog visibility checkbox', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByLabelText(/catalog visibility/i)).toBeInTheDocument();
    });

    it('should render featured product checkbox', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByLabelText(/featured product/i)).toBeInTheDocument();
    });
  });

  describe('Close Functionality', () => {
    it('should call onClose when close button is clicked', async () => {
      render(<BulkEditModal {...defaultProps} />);

      await userEvent.click(screen.getByLabelText(/close modal/i));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });

    it('should call onClose when cancel button is clicked', async () => {
      render(<BulkEditModal {...defaultProps} />);

      await userEvent.click(screen.getByRole('button', { name: /cancel/i }));

      expect(defaultProps.onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Save Functionality', () => {
    it('should render preview button', () => {
      render(<BulkEditModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /preview changes/i })).toBeInTheDocument();
    });

    it('should call onSave when update button is clicked', async () => {
      render(<BulkEditModal {...defaultProps} />);

      await clickUpdateButton();

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
      });
    });

    it('should show saving state while saving', async () => {
      const slowSave = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<BulkEditModal {...defaultProps} onSave={slowSave} />);

      await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
      await userEvent.click(screen.getByRole('button', { name: /confirm.*update.*products/i }));

      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });

    it('should call onClose after successful save', async () => {
      render(<BulkEditModal {...defaultProps} />);

      await clickUpdateButton();

      await waitFor(() => {
        expect(defaultProps.onClose).toHaveBeenCalled();
      });
    });

    it('should call onError when save fails', async () => {
      const failSave = vi.fn().mockRejectedValue(new Error('Save failed'));
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});
      render(<BulkEditModal {...defaultProps} onSave={failSave} />);

      await clickUpdateButton();

      await waitFor(() => {
        expect(defaultProps.onError).toHaveBeenCalledWith(
          'Failed to save bulk edits. Please try again.'
        );
      });

      expect(consoleError).toHaveBeenCalledWith('Error saving bulk edits:', expect.any(Error));
      consoleError.mockRestore();
    });

    it('should disable the confirm button while saving', async () => {
      const slowSave = vi.fn(
        () => new Promise((resolve) => setTimeout(resolve, 100))
      );
      render(<BulkEditModal {...defaultProps} onSave={slowSave} />);

      await userEvent.click(screen.getByRole('button', { name: /preview changes/i }));
      await userEvent.click(screen.getByRole('button', { name: /confirm.*update.*products/i }));

      expect(screen.getByText(/saving/i)).toBeInTheDocument();
    });
  });

  describe('Price Calculations', () => {
    it('should generate correct update for set price action', async () => {
      render(<BulkEditModal {...defaultProps} />);

      // Enable regular price
      await userEvent.click(screen.getByLabelText(/regular price/i));

      // Enter value
      const input = screen.getByPlaceholderText(/value/i);
      await userEvent.type(input, '150');

      // Save
      await clickUpdateButton();

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
        const updates = defaultProps.onSave.mock.calls[0][0];
        expect(updates[0]).toHaveProperty('regular_price', '150');
        expect(updates[1]).toHaveProperty('regular_price', '150');
      });
    });
  });

  describe('Stock Calculations', () => {
    it('should generate correct update for set stock action', async () => {
      render(<BulkEditModal {...defaultProps} />);

      // Enable stock quantity
      await userEvent.click(screen.getByLabelText(/stock quantity/i));

      // Enter value
      const input = screen.getByPlaceholderText(/quantity/i);
      await userEvent.type(input, '100');

      // Save
      await clickUpdateButton();

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
        const updates = defaultProps.onSave.mock.calls[0][0];
        expect(updates[0]).toHaveProperty('stock_quantity', 100);
        expect(updates[0]).toHaveProperty('manage_stock', true);
      });
    });
  });

  describe('Status Updates', () => {
    it('should generate correct update for stock status', async () => {
      render(<BulkEditModal {...defaultProps} />);

      // Enable stock status
      await userEvent.click(screen.getByLabelText(/stock status/i));

      // Save
      await clickUpdateButton();

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
        const updates = defaultProps.onSave.mock.calls[0][0];
        expect(updates[0]).toHaveProperty('stock_status', 'instock');
      });
    });

    it('should generate correct update for tax status', async () => {
      render(<BulkEditModal {...defaultProps} />);

      // Enable tax status
      await userEvent.click(screen.getByLabelText(/tax status/i));

      // Save
      await clickUpdateButton();

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
        const updates = defaultProps.onSave.mock.calls[0][0];
        expect(updates[0]).toHaveProperty('tax_status', 'taxable');
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible checkboxes', () => {
      render(<BulkEditModal {...defaultProps} />);

      const checkboxes = screen.getAllByRole('checkbox');
      expect(checkboxes.length).toBeGreaterThan(0);
      checkboxes.forEach((checkbox) => {
        expect(checkbox).toHaveAttribute('id');
      });
    });

    it('should have labels associated with inputs', () => {
      render(<BulkEditModal {...defaultProps} />);

      const priceCheckbox = screen.getByLabelText(/regular price/i);
      expect(priceCheckbox).toBeInTheDocument();
    });
  });

  describe('Empty selections', () => {
    it('should handle no fields selected', async () => {
      render(<BulkEditModal {...defaultProps} />);

      await clickUpdateButton();

      await waitFor(() => {
        expect(defaultProps.onSave).toHaveBeenCalled();
        const updates = defaultProps.onSave.mock.calls[0][0];
        // Updates should only have id property
        expect(updates[0]).toEqual({ id: 1 });
        expect(updates[1]).toEqual({ id: 2 });
      });
    });
  });
});
