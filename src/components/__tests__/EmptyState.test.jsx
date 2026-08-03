import { vi } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Package, ShoppingCart, Search } from 'lucide-react';
import EmptyState from '../EmptyState';

describe('EmptyState', () => {
  describe('Rendering', () => {
    it('should render title', () => {
      render(<EmptyState title="No items found" />);

      expect(screen.getByText('No items found')).toBeInTheDocument();
    });

    it('should render with default icon (Inbox)', () => {
      render(<EmptyState title="No items" />);

      // The default icon is Inbox - we can check by the aria-hidden attribute
      const icon = document.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it('should render with custom icon', () => {
      render(<EmptyState title="No products" icon={Package} />);

      const icon = document.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it('should render message when provided', () => {
      render(
        <EmptyState
          title="No items"
          message="Try adjusting your search or filters"
        />
      );

      expect(screen.getByText('Try adjusting your search or filters')).toBeInTheDocument();
    });

    it('should not render message when not provided', () => {
      render(<EmptyState title="No items" />);

      // Only title should be present
      expect(screen.queryByRole('paragraph')).not.toBeInTheDocument();
    });

    it('should render action when provided', () => {
      render(
        <EmptyState
          title="No items"
          action={<button>Add Item</button>}
        />
      );

      expect(screen.getByRole('button', { name: 'Add Item' })).toBeInTheDocument();
    });

    it('should not render action container when action is not provided', () => {
      const { container } = render(<EmptyState title="No items" />);

      // Check that there's no empty action div
      const paragraphs = container.querySelectorAll('p');
      expect(paragraphs.length).toBe(0);
    });
  });

  describe('Styling', () => {
    it('should apply centered text alignment', () => {
      const { container } = render(<EmptyState title="No items" />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('text-center');
    });

    it('should apply proper vertical padding', () => {
      const { container } = render(<EmptyState title="No items" />);

      const wrapper = container.firstChild;
      expect(wrapper).toHaveClass('py-12');
    });

    it('should have proper icon styling', () => {
      render(<EmptyState title="No items" icon={Package} />);

      const icon = document.querySelector('[aria-hidden="true"]');
      expect(icon).toHaveClass('w-12', 'h-12', 'mx-auto');
    });

    it('should have proper title styling', () => {
      render(<EmptyState title="No items" />);

      const title = screen.getByText('No items');
      expect(title.tagName).toBe('H3');
      expect(title).toHaveClass('text-lg', 'font-medium');
    });

    it('should have proper message styling', () => {
      render(<EmptyState title="No items" message="Some message" />);

      const message = screen.getByText('Some message');
      expect(message.tagName).toBe('P');
      expect(message).toHaveClass('max-w-md', 'mx-auto');
    });
  });

  describe('Custom Actions', () => {
    it('should render button action', async () => {
      const handleClick = vi.fn();
      render(
        <EmptyState
          title="No items"
          action={<button onClick={handleClick}>Click me</button>}
        />
      );

      await userEvent.click(screen.getByText('Click me'));

      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('should render link action', () => {
      render(
        <EmptyState
          title="No items"
          action={<a href="/add">Add new item</a>}
        />
      );

      expect(screen.getByRole('link', { name: 'Add new item' })).toHaveAttribute('href', '/add');
    });

    it('should render complex action with multiple elements', () => {
      render(
        <EmptyState
          title="No items"
          action={
            <div className="flex gap-2">
              <button>Primary Action</button>
              <button>Secondary Action</button>
            </div>
          }
        />
      );

      expect(screen.getByText('Primary Action')).toBeInTheDocument();
      expect(screen.getByText('Secondary Action')).toBeInTheDocument();
    });
  });

  describe('Different Icons', () => {
    it('should render with ShoppingCart icon', () => {
      render(<EmptyState title="No orders" icon={ShoppingCart} />);

      const icon = document.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });

    it('should render with Search icon', () => {
      render(<EmptyState title="No results" icon={Search} />);

      const icon = document.querySelector('[aria-hidden="true"]');
      expect(icon).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('should have icon with aria-hidden', () => {
      render(<EmptyState title="No items" />);

      const icon = document.querySelector('[aria-hidden="true"]');
      expect(icon).toHaveAttribute('aria-hidden', 'true');
    });

    it('should have semantic heading', () => {
      render(<EmptyState title="No items" />);

      expect(screen.getByRole('heading', { level: 3 })).toBeInTheDocument();
    });
  });

  describe('Dark Mode Support', () => {
    it('should have dark mode classes', () => {
      render(<EmptyState title="No items" message="Some message" />);

      const title = screen.getByText('No items');
      expect(title).toHaveClass('dark:text-white');

      const message = screen.getByText('Some message');
      expect(message).toHaveClass('dark:text-gray-400');
    });
  });

  describe('Integration Scenarios', () => {
    it('should render empty products state', () => {
      render(
        <EmptyState
          icon={Package}
          title="No products found"
          message="Add your first product to get started"
          action={<button className="btn-primary">Add Product</button>}
        />
      );

      expect(screen.getByText('No products found')).toBeInTheDocument();
      expect(screen.getByText('Add your first product to get started')).toBeInTheDocument();
      expect(screen.getByText('Add Product')).toBeInTheDocument();
    });

    it('should render empty orders state', () => {
      render(
        <EmptyState
          icon={ShoppingCart}
          title="No orders yet"
          message="Orders will appear here once customers start purchasing"
        />
      );

      expect(screen.getByText('No orders yet')).toBeInTheDocument();
      expect(screen.getByText('Orders will appear here once customers start purchasing')).toBeInTheDocument();
    });

    it('should render search results empty state', () => {
      render(
        <EmptyState
          icon={Search}
          title="No results for 'xyz'"
          message="Try different keywords or check spelling"
          action={
            <button>Clear Search</button>
          }
        />
      );

      expect(screen.getByText("No results for 'xyz'")).toBeInTheDocument();
      expect(screen.getByText('Clear Search')).toBeInTheDocument();
    });
  });
});
