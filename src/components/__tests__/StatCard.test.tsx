import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import StatCard, { type StatCardColor } from '../StatCard';
import { ShoppingCart } from 'lucide-react';

describe('StatCard', () => {
  it('should render label and string value', () => {
    render(<StatCard label="Total Orders" value="142" />);

    expect(screen.getByText('Total Orders')).toBeInTheDocument();
    expect(screen.getByText('142')).toBeInTheDocument();
  });

  it('should render numeric value', () => {
    render(<StatCard label="Products" value={85} />);

    expect(screen.getByText('85')).toBeInTheDocument();
  });

  it('should render as a div when no link is provided', () => {
    const { container } = render(<StatCard label="Orders" value="10" />);

    expect(container.querySelector('a')).not.toBeInTheDocument();
    expect(container.querySelector('div')).toBeInTheDocument();
  });

  it('should render as a Link when link is provided', () => {
    render(
      <MemoryRouter>
        <StatCard label="Orders" value="10" link="/orders" />
      </MemoryRouter>
    );

    const link = screen.getByRole('link');
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/orders');
  });

  it('should use custom ariaLabel on link', () => {
    render(
      <MemoryRouter>
        <StatCard label="Orders" value="10" link="/orders" ariaLabel="View all orders" />
      </MemoryRouter>
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label', 'View all orders');
  });

  it('should generate default ariaLabel when not provided', () => {
    render(
      <MemoryRouter>
        <StatCard label="Orders" value="10" link="/orders" />
      </MemoryRouter>
    );

    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('aria-label', 'Orders: 10');
  });

  it('should render icon when provided', () => {
    const { container } = render(
      <StatCard label="Cart" value="5" icon={ShoppingCart} />
    );

    const svg = container.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('should not render icon when not provided', () => {
    const { container } = render(<StatCard label="Cart" value="5" />);

    const svg = container.querySelector('svg');
    expect(svg).not.toBeInTheDocument();
  });

  it('should apply color classes', () => {
    render(<StatCard label="Revenue" value="$1000" color="green" />);

    const valueEl = screen.getByText('$1000');
    expect(valueEl.className).toContain('text-green-600');
  });

  it('should default to gray color', () => {
    render(<StatCard label="Revenue" value="$1000" />);

    const valueEl = screen.getByText('$1000');
    expect(valueEl.className).toContain('text-gray-900');
  });

  it('should apply different color classes correctly', () => {
    const colors: StatCardColor[] = ['blue', 'red', 'yellow', 'purple'];

    colors.forEach((color) => {
      const { unmount } = render(
        <StatCard label="Test" value="0" color={color} />
      );

      const valueEl = screen.getByText('0');
      expect(valueEl.className).toContain(`text-${color}-600`);

      unmount();
    });
  });
});
