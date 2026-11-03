import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import ListStatus from '../ListStatus';

describe('ListStatus', () => {
  it('is a polite status region that announces loading then the count', () => {
    const { rerender } = render(<ListStatus loading count={0} noun="orders" />);
    const region = screen.getByRole('status');
    expect(region).toHaveAttribute('aria-live', 'polite');
    expect(region).toHaveClass('sr-only');
    expect(region).toHaveTextContent('Loading orders…');
    rerender(<ListStatus loading={false} count={12} noun="orders" />);
    expect(screen.getByRole('status')).toHaveTextContent('12 orders found');
  });
});
