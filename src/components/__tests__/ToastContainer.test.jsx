import { vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ToastContainer from '../ToastContainer';

// Mock the Toast component to simplify testing
vi.mock('../Toast', () => ({
  default: function MockToast({ id, message, type, onClose }) {
    return (
      <div data-testid={`toast-${id}`} className={`toast toast-${type}`}>
        <span>{message}</span>
        <button onClick={() => onClose(id)}>Close</button>
      </div>
    );
  },
}));

describe('ToastContainer', () => {
  const mockRemoveToast = vi.fn();

  const defaultToasts = [
    { id: 1, message: 'First toast', type: 'info', duration: 3000 },
    { id: 2, message: 'Second toast', type: 'success', duration: 3000 },
    { id: 3, message: 'Third toast', type: 'error', duration: 3000 },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render empty container when no toasts', () => {
    const { container } = render(<ToastContainer toasts={[]} removeToast={mockRemoveToast} />);

    expect(container.firstChild).toBeInTheDocument();
    expect(screen.queryByTestId(/toast-/)).not.toBeInTheDocument();
  });

  it('should render single toast', () => {
    const toasts = [{ id: 1, message: 'Test message', type: 'info' }];

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />);

    expect(screen.getByTestId('toast-1')).toBeInTheDocument();
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should render multiple toasts', () => {
    render(<ToastContainer toasts={defaultToasts} removeToast={mockRemoveToast} />);

    expect(screen.getByTestId('toast-1')).toBeInTheDocument();
    expect(screen.getByTestId('toast-2')).toBeInTheDocument();
    expect(screen.getByTestId('toast-3')).toBeInTheDocument();

    expect(screen.getByText('First toast')).toBeInTheDocument();
    expect(screen.getByText('Second toast')).toBeInTheDocument();
    expect(screen.getByText('Third toast')).toBeInTheDocument();
  });

  it('should call removeToast when close button is clicked', async () => {
    const user = userEvent.setup();
    const toasts = [{ id: 1, message: 'Test message', type: 'info' }];

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />);

    const closeButton = screen.getByRole('button', { name: /close/i });
    await user.click(closeButton);

    expect(mockRemoveToast).toHaveBeenCalledWith(1);
  });

  it('should call removeToast with correct ID for each toast', async () => {
    const user = userEvent.setup();

    render(<ToastContainer toasts={defaultToasts} removeToast={mockRemoveToast} />);

    const closeButtons = screen.getAllByRole('button', { name: /close/i });

    // Click the second toast's close button
    await user.click(closeButtons[1]);

    expect(mockRemoveToast).toHaveBeenCalledWith(2);
  });

  it('should render toasts in correct order', () => {
    render(<ToastContainer toasts={defaultToasts} removeToast={mockRemoveToast} />);

    const toastElements = screen.getAllByTestId(/toast-/);

    expect(toastElements[0]).toHaveAttribute('data-testid', 'toast-1');
    expect(toastElements[1]).toHaveAttribute('data-testid', 'toast-2');
    expect(toastElements[2]).toHaveAttribute('data-testid', 'toast-3');
  });

  it('should pass correct type to Toast component', () => {
    const toasts = [
      { id: 1, message: 'Info', type: 'info' },
      { id: 2, message: 'Success', type: 'success' },
      { id: 3, message: 'Error', type: 'error' },
      { id: 4, message: 'Warning', type: 'warning' },
    ];

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />);

    expect(screen.getByTestId('toast-1')).toHaveClass('toast-info');
    expect(screen.getByTestId('toast-2')).toHaveClass('toast-success');
    expect(screen.getByTestId('toast-3')).toHaveClass('toast-error');
    expect(screen.getByTestId('toast-4')).toHaveClass('toast-warning');
  });

  it('should apply correct container styles', () => {
    const { container } = render(
      <ToastContainer toasts={defaultToasts} removeToast={mockRemoveToast} />
    );

    const toastContainer = container.firstChild;
    expect(toastContainer).toHaveClass('fixed');
    expect(toastContainer).toHaveClass('top-4');
    expect(toastContainer).toHaveClass('right-4');
    expect(toastContainer).toHaveClass('z-50');
  });

  it('should update when toasts prop changes', () => {
    const { rerender } = render(
      <ToastContainer toasts={[]} removeToast={mockRemoveToast} />
    );

    expect(screen.queryByTestId(/toast-/)).not.toBeInTheDocument();

    rerender(
      <ToastContainer toasts={defaultToasts} removeToast={mockRemoveToast} />
    );

    expect(screen.getByTestId('toast-1')).toBeInTheDocument();
    expect(screen.getByTestId('toast-2')).toBeInTheDocument();
    expect(screen.getByTestId('toast-3')).toBeInTheDocument();
  });

  it('should handle toasts being removed', () => {
    const { rerender } = render(
      <ToastContainer toasts={defaultToasts} removeToast={mockRemoveToast} />
    );

    expect(screen.getAllByTestId(/toast-/)).toHaveLength(3);

    // Remove the second toast
    const updatedToasts = defaultToasts.filter((t) => t.id !== 2);

    rerender(
      <ToastContainer toasts={updatedToasts} removeToast={mockRemoveToast} />
    );

    expect(screen.getAllByTestId(/toast-/)).toHaveLength(2);
    expect(screen.queryByTestId('toast-2')).not.toBeInTheDocument();
  });

  it('should handle toast with undefined type', () => {
    const toasts = [{ id: 1, message: 'No type specified' }];

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />);

    expect(screen.getByTestId('toast-1')).toBeInTheDocument();
    expect(screen.getByText('No type specified')).toBeInTheDocument();
  });

  it('should handle toast with undefined duration', () => {
    const toasts = [{ id: 1, message: 'No duration', type: 'info' }];

    render(<ToastContainer toasts={toasts} removeToast={mockRemoveToast} />);

    expect(screen.getByTestId('toast-1')).toBeInTheDocument();
  });
});
