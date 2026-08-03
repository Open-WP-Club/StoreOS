import { vi } from 'vitest';
import React from 'react';
import { render, renderHook, act, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ToastProvider, useToast } from '../ToastContext';

// Mock ToastContainer
vi.mock('../../components/ToastContainer', () => ({
  default: function MockToastContainer({ toasts, removeToast }) {
    return (
      <div data-testid="toast-container">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            data-testid={`toast-${toast.type}`}
            className={`toast-${toast.type}`}
          >
            <span>{toast.message}</span>
            <button onClick={() => removeToast(toast.id)}>Remove</button>
          </div>
        ))}
      </div>
    );
  },
}));

// Test component that uses the useToast hook
// eslint-disable-next-line react/prop-types -- test-only helper, not worth a prop-types dependency
function TestComponent({ onToast }) {
  const toast = useToast();

  return (
    <div>
      <button onClick={() => onToast(toast.success('Success message'))}>
        Show Success
      </button>
      <button onClick={() => onToast(toast.error('Error message'))}>
        Show Error
      </button>
      <button onClick={() => onToast(toast.warning('Warning message'))}>
        Show Warning
      </button>
      <button onClick={() => onToast(toast.info('Info message'))}>
        Show Info
      </button>
      <button onClick={() => onToast(toast.success('Custom duration', 5000))}>
        Custom Duration
      </button>
    </div>
  );
}

describe('ToastContext', () => {
  describe('ToastProvider', () => {
    it('should render children', () => {
      render(
        <ToastProvider>
          <div data-testid="child">Child content</div>
        </ToastProvider>
      );

      expect(screen.getByTestId('child')).toBeInTheDocument();
    });

    it('should render ToastContainer', () => {
      render(
        <ToastProvider>
          <div>Content</div>
        </ToastProvider>
      );

      expect(screen.getByTestId('toast-container')).toBeInTheDocument();
    });
  });

  describe('useToast hook', () => {
    it('should throw error when used outside ToastProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      function BrokenComponent() {
        useToast();
        return null;
      }

      expect(() => render(<BrokenComponent />)).toThrow(
        'useToast must be used within a ToastProvider'
      );

      consoleError.mockRestore();
    });

    it('should provide toast methods', () => {
      const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });

      expect(result.current).toHaveProperty('success');
      expect(result.current).toHaveProperty('error');
      expect(result.current).toHaveProperty('warning');
      expect(result.current).toHaveProperty('info');
    });
  });

  describe('Toast methods', () => {
    it('should show success toast', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Success'));

      expect(screen.getByTestId('toast-success')).toBeInTheDocument();
      expect(screen.getByText('Success message')).toBeInTheDocument();
    });

    it('should show error toast', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Error'));

      expect(screen.getByTestId('toast-error')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('should show warning toast', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Warning'));

      expect(screen.getByTestId('toast-warning')).toBeInTheDocument();
      expect(screen.getByText('Warning message')).toBeInTheDocument();
    });

    it('should show info toast', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Info'));

      expect(screen.getByTestId('toast-info')).toBeInTheDocument();
      expect(screen.getByText('Info message')).toBeInTheDocument();
    });

    it('should return toast ID', async () => {
      let toastId;
      const handleToast = (id) => {
        toastId = id;
      };

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Success'));

      expect(toastId).toBeDefined();
      expect(typeof toastId).toBe('string');
    });
  });

  describe('Multiple toasts', () => {
    it('should show multiple toasts', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Success'));
      await userEvent.click(screen.getByText('Show Error'));

      expect(screen.getByText('Success message')).toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });

    it('should generate unique IDs for each toast', async () => {
      const toastIds = [];
      const handleToast = (id) => {
        toastIds.push(id);
      };

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Success'));
      await userEvent.click(screen.getByText('Show Success'));
      await userEvent.click(screen.getByText('Show Success'));

      // All IDs should be unique
      const uniqueIds = new Set(toastIds);
      expect(uniqueIds.size).toBe(toastIds.length);
    });
  });

  describe('Removing toasts', () => {
    it('should remove toast when remove is called', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Success'));
      expect(screen.getByText('Success message')).toBeInTheDocument();

      await userEvent.click(screen.getByText('Remove'));
      expect(screen.queryByText('Success message')).not.toBeInTheDocument();
    });

    it('should only remove specific toast', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Success'));
      await userEvent.click(screen.getByText('Show Error'));

      // Remove the first one (success)
      const removeButtons = screen.getAllByText('Remove');
      await userEvent.click(removeButtons[0]);

      expect(screen.queryByText('Success message')).not.toBeInTheDocument();
      expect(screen.getByText('Error message')).toBeInTheDocument();
    });
  });

  describe('Custom duration', () => {
    it('should accept custom duration', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Custom Duration'));

      expect(screen.getByText('Custom duration')).toBeInTheDocument();
    });
  });

  describe('Toast types', () => {
    it('should apply correct type to toast', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      await userEvent.click(screen.getByText('Show Success'));
      expect(screen.getByTestId('toast-success')).toHaveClass('toast-success');

      await userEvent.click(screen.getByText('Show Error'));
      expect(screen.getByTestId('toast-error')).toHaveClass('toast-error');

      await userEvent.click(screen.getByText('Show Warning'));
      expect(screen.getByTestId('toast-warning')).toHaveClass('toast-warning');

      await userEvent.click(screen.getByText('Show Info'));
      expect(screen.getByTestId('toast-info')).toHaveClass('toast-info');
    });
  });

  describe('Edge cases', () => {
    it('should handle empty message', async () => {
      const { result } = renderHook(() => useToast(), { wrapper: ToastProvider });

      await act(async () => {
        result.current.success('');
      });

      expect(screen.getByTestId('toast-success')).toBeInTheDocument();
    });

    it('should handle rapid toast creation', async () => {
      const handleToast = vi.fn();

      render(
        <ToastProvider>
          <TestComponent onToast={handleToast} />
        </ToastProvider>
      );

      // Rapidly create multiple toasts
      const button = screen.getByText('Show Success');
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);
      await userEvent.click(button);

      // All toasts should be created
      const toasts = screen.getAllByText('Success message');
      expect(toasts.length).toBe(5);
    });
  });
});
