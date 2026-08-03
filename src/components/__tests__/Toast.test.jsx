import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Toast from '../Toast';

describe('Toast', () => {
  const defaultProps = {
    id: '1',
    message: 'Test message',
    type: 'info',
    duration: 3000,
    onClose: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('should render toast with message', () => {
    render(<Toast {...defaultProps} />);
    expect(screen.getByText('Test message')).toBeInTheDocument();
  });

  it('should render info toast with correct styling', () => {
    const { container } = render(<Toast {...defaultProps} type="info" />);
    const toast = container.firstChild;
    expect(toast).toHaveClass('bg-blue-50');
  });

  it('should render success toast with correct icon and styling', () => {
    const { container } = render(<Toast {...defaultProps} type="success" />);
    const toast = container.firstChild;
    expect(toast).toHaveClass('bg-green-50');
  });

  it('should render error toast with correct styling', () => {
    const { container } = render(<Toast {...defaultProps} type="error" />);
    const toast = container.firstChild;
    expect(toast).toHaveClass('bg-red-50');
  });

  it('should render warning toast with correct styling', () => {
    const { container } = render(<Toast {...defaultProps} type="warning" />);
    const toast = container.firstChild;
    expect(toast).toHaveClass('bg-yellow-50');
  });

  it('should call onClose when close button is clicked', () => {
    const onClose = vi.fn();

    render(<Toast {...defaultProps} onClose={onClose} />);

    const closeButton = screen.getByRole('button');
    fireEvent.click(closeButton);

    expect(onClose).toHaveBeenCalledWith('1');
  });

  it('should auto-close after duration', () => {
    const onClose = vi.fn();

    render(<Toast {...defaultProps} duration={3000} onClose={onClose} />);

    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(2999);
    expect(onClose).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(onClose).toHaveBeenCalledWith('1');
  });

  it('should not auto-close when duration is 0', async () => {
    const onClose = vi.fn();

    render(<Toast {...defaultProps} duration={0} onClose={onClose} />);

    vi.advanceTimersByTime(10000);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should not auto-close when duration is null', async () => {
    const onClose = vi.fn();

    render(<Toast {...defaultProps} duration={null} onClose={onClose} />);

    vi.advanceTimersByTime(10000);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should cleanup timer on unmount', () => {
    const onClose = vi.fn();
    const { unmount } = render(<Toast {...defaultProps} duration={3000} onClose={onClose} />);

    unmount();

    vi.advanceTimersByTime(3000);

    expect(onClose).not.toHaveBeenCalled();
  });

  it('should handle long messages', () => {
    const longMessage = 'This is a very long toast message that should still display correctly';
    render(<Toast {...defaultProps} message={longMessage} />);

    expect(screen.getByText(longMessage)).toBeInTheDocument();
  });

  it('should render with correct accessibility attributes', () => {
    render(<Toast {...defaultProps} />);

    const closeButton = screen.getByRole('button');
    expect(closeButton).toBeInTheDocument();
  });
});
