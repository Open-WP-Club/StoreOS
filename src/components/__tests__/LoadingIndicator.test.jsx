import { render, screen } from '@testing-library/react';
import LoadingIndicator from '../LoadingIndicator';

describe('LoadingIndicator', () => {
  it('should not render when not loading', () => {
    const loadingState = {
      isLoading: false,
      loaded: 0,
      total: 0,
      progress: 0,
      dataType: 'products',
    };

    const { container } = render(<LoadingIndicator loadingState={loadingState} />);
    expect(container.firstChild).toBeNull();
  });

  it('should render when loading', () => {
    const loadingState = {
      isLoading: true,
      loaded: 50,
      total: 100,
      progress: 50,
      dataType: 'products',
    };

    render(<LoadingIndicator loadingState={loadingState} />);
    expect(screen.getByText('Loading products...')).toBeInTheDocument();
  });

  it('should display correct progress information', () => {
    const loadingState = {
      isLoading: true,
      loaded: 50,
      total: 100,
      progress: 50,
      dataType: 'products',
    };

    render(<LoadingIndicator loadingState={loadingState} />);
    expect(screen.getByText('50 / 100 items (50%)')).toBeInTheDocument();
  });

  it('should display "Initializing..." when total is 0', () => {
    const loadingState = {
      isLoading: true,
      loaded: 0,
      total: 0,
      progress: 0,
      dataType: 'products',
    };

    render(<LoadingIndicator loadingState={loadingState} />);
    expect(screen.getByText('Initializing...')).toBeInTheDocument();
  });

  it('should display different data types correctly', () => {
    const loadingState = {
      isLoading: true,
      loaded: 25,
      total: 50,
      progress: 50,
      dataType: 'orders',
    };

    render(<LoadingIndicator loadingState={loadingState} />);
    expect(screen.getByText('Loading orders...')).toBeInTheDocument();
  });

  it('should render progress bar with correct width', () => {
    const loadingState = {
      isLoading: true,
      loaded: 75,
      total: 100,
      progress: 75,
      dataType: 'products',
    };

    render(<LoadingIndicator loadingState={loadingState} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveStyle({ width: '75%' });
  });

  it('should have correct ARIA attributes', () => {
    const loadingState = {
      isLoading: true,
      loaded: 50,
      total: 100,
      progress: 50,
      dataType: 'products',
    };

    render(<LoadingIndicator loadingState={loadingState} />);

    const status = screen.getByRole('status');
    expect(status).toHaveAttribute('aria-live', 'polite');
    expect(status).toHaveAttribute(
      'aria-label',
      'Loading products: 50 of 100 items'
    );
  });

  it('should have correct progressbar ARIA attributes', () => {
    const loadingState = {
      isLoading: true,
      loaded: 60,
      total: 100,
      progress: 60,
      dataType: 'products',
    };

    render(<LoadingIndicator loadingState={loadingState} />);

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveAttribute('aria-valuenow', '60');
    expect(progressBar).toHaveAttribute('aria-valuemin', '0');
    expect(progressBar).toHaveAttribute('aria-valuemax', '100');
  });

  it('should not render progress bar when total is 0', () => {
    const loadingState = {
      isLoading: true,
      loaded: 0,
      total: 0,
      progress: 0,
      dataType: 'products',
    };

    render(<LoadingIndicator loadingState={loadingState} />);

    expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
  });

  it('should handle 100% progress', () => {
    const loadingState = {
      isLoading: true,
      loaded: 100,
      total: 100,
      progress: 100,
      dataType: 'products',
    };

    render(<LoadingIndicator loadingState={loadingState} />);

    expect(screen.getByText('100 / 100 items (100%)')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveStyle({ width: '100%' });
  });

  it('should handle 0% progress', () => {
    const loadingState = {
      isLoading: true,
      loaded: 0,
      total: 100,
      progress: 0,
      dataType: 'products',
    };

    render(<LoadingIndicator loadingState={loadingState} />);

    expect(screen.getByText('0 / 100 items (0%)')).toBeInTheDocument();
    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toHaveStyle({ width: '0%' });
  });
});
