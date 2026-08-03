import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import ErrorAlert from '../ErrorAlert';

describe('ErrorAlert', () => {
  it('should render the error message', () => {
    render(<ErrorAlert message="Something went wrong" />);

    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('should not show dismiss button when onDismiss is not provided', () => {
    render(<ErrorAlert message="Error occurred" />);

    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('should show dismiss button when onDismiss is provided', () => {
    const onDismiss = vi.fn();
    render(<ErrorAlert message="Error occurred" onDismiss={onDismiss} />);

    const button = screen.getByRole('button');
    expect(button).toBeInTheDocument();
  });

  it('should call onDismiss when dismiss button is clicked', () => {
    const onDismiss = vi.fn();
    render(<ErrorAlert message="Error occurred" onDismiss={onDismiss} />);

    fireEvent.click(screen.getByRole('button'));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('should render with correct styling classes', () => {
    const { container } = render(<ErrorAlert message="Error" />);

    const alertDiv = container.firstChild;
    expect(alertDiv).toHaveClass('bg-red-50');
  });

  it('should display the alert icon', () => {
    const { container } = render(<ErrorAlert message="Error" />);

    // The AlertCircle icon renders as an SVG
    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });
});
