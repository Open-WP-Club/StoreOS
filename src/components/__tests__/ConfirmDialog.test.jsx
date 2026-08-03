import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from '../ConfirmDialog';

describe('ConfirmDialog', () => {
  const defaultProps = {
    isOpen: true,
    onConfirm: vi.fn(),
    onCancel: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // Reset body overflow
    document.body.style.overflow = '';
  });

  describe('Rendering', () => {
    it('should not render when isOpen is false', () => {
      render(<ConfirmDialog {...defaultProps} isOpen={false} />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('should render when isOpen is true', () => {
      render(<ConfirmDialog {...defaultProps} />);

      // Component has nested dialogs for accessibility, so we use getAllByRole
      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs.length).toBeGreaterThan(0);
    });

    it('should display default title', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText('Confirm Action')).toBeInTheDocument();
    });

    it('should display custom title', () => {
      render(<ConfirmDialog {...defaultProps} title="Delete Item" />);

      expect(screen.getByText('Delete Item')).toBeInTheDocument();
    });

    it('should display default message', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
    });

    it('should display custom message', () => {
      render(<ConfirmDialog {...defaultProps} message="This action cannot be undone." />);

      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    });

    it('should display default button labels', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByText('Confirm')).toBeInTheDocument();
      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });

    it('should display custom button labels', () => {
      render(
        <ConfirmDialog
          {...defaultProps}
          confirmLabel="Delete"
          cancelLabel="Keep"
        />
      );

      expect(screen.getByText('Delete')).toBeInTheDocument();
      expect(screen.getByText('Keep')).toBeInTheDocument();
    });

    it('should render close button', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByLabelText('Close')).toBeInTheDocument();
    });
  });

  describe('Variants', () => {
    it('should render danger variant by default', () => {
      render(<ConfirmDialog {...defaultProps} />);

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveClass('bg-red-600');
    });

    it('should render warning variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="warning" />);

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveClass('bg-yellow-600');
    });

    it('should render info variant', () => {
      render(<ConfirmDialog {...defaultProps} variant="info" />);

      const confirmButton = screen.getByText('Confirm');
      expect(confirmButton).toHaveClass('bg-blue-600');
    });
  });

  describe('User Interactions', () => {
    it('should call onConfirm when confirm button is clicked', async () => {
      render(<ConfirmDialog {...defaultProps} />);

      await userEvent.click(screen.getByText('Confirm'));

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when cancel button is clicked', async () => {
      render(<ConfirmDialog {...defaultProps} />);

      await userEvent.click(screen.getByText('Cancel'));

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when close button is clicked', async () => {
      render(<ConfirmDialog {...defaultProps} />);

      await userEvent.click(screen.getByLabelText('Close'));

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onCancel when backdrop is clicked', async () => {
      render(<ConfirmDialog {...defaultProps} />);

      const backdrop = document.querySelector('[aria-hidden="true"]');
      fireEvent.click(backdrop);

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });
  });

  describe('Keyboard Navigation', () => {
    it('should call onCancel when Escape is pressed', () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onCancel).toHaveBeenCalledTimes(1);
    });

    it('should call onConfirm when Enter is pressed', () => {
      render(<ConfirmDialog {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(1);
    });

    it('should not call onConfirm when Enter is pressed while loading', () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(defaultProps.onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('Loading State', () => {
    it('should show loading indicator when isLoading is true', () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      expect(screen.getByText('Processing...')).toBeInTheDocument();
    });

    it('should disable confirm button when loading', () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      const confirmButton = screen.getByText('Processing...').closest('button');
      expect(confirmButton).toBeDisabled();
    });

    it('should disable cancel button when loading', () => {
      render(<ConfirmDialog {...defaultProps} isLoading={true} />);

      const cancelButton = screen.getByText('Cancel');
      expect(cancelButton).toBeDisabled();
    });
  });

  describe('Body Overflow', () => {
    it('should set body overflow to hidden when opened', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('should reset body overflow when closed', () => {
      const { rerender } = render(<ConfirmDialog {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      rerender(<ConfirmDialog {...defaultProps} isOpen={false} />);

      expect(document.body.style.overflow).toBe('');
    });

    it('should reset body overflow on unmount', () => {
      const { unmount } = render(<ConfirmDialog {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');

      unmount();

      expect(document.body.style.overflow).toBe('');
    });
  });

  describe('Accessibility', () => {
    it('should have proper ARIA attributes', () => {
      render(<ConfirmDialog {...defaultProps} />);

      const dialogs = screen.getAllByRole('dialog');
      expect(dialogs.length).toBeGreaterThan(0);
    });

    it('should have modal title with proper id', () => {
      render(<ConfirmDialog {...defaultProps} title="Test Title" />);

      const title = screen.getByText('Test Title');
      expect(title).toHaveAttribute('id', 'modal-title');
    });

    it('should have accessible buttons', () => {
      render(<ConfirmDialog {...defaultProps} />);

      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Close' })).toBeInTheDocument();
    });
  });

  describe('Edge Cases', () => {
    it('should handle multiple opens and closes', async () => {
      const { rerender } = render(<ConfirmDialog {...defaultProps} isOpen={false} />);

      // Open
      rerender(<ConfirmDialog {...defaultProps} />);
      expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);

      // Close
      rerender(<ConfirmDialog {...defaultProps} isOpen={false} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      // Open again
      rerender(<ConfirmDialog {...defaultProps} />);
      expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
    });

    it('should handle rapid keyboard events', () => {
      render(<ConfirmDialog {...defaultProps} />);

      // Fire multiple Enter events
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Enter' });

      // Only should be called once per event
      expect(defaultProps.onConfirm).toHaveBeenCalledTimes(2);
    });
  });
});
