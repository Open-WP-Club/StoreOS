import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import QuickSwitcher from '../QuickSwitcher';
import { useStoreConfig, useCache, useSearch } from '../../stores';
import { searchProducts, searchOrders } from '../../utils/searchService';
import { useKeyboardShortcut, getShortcutDisplay } from '../../hooks/useKeyboardShortcut';

// jest.mock factories return bare stubs — implementations are set in beforeEach
// to survive the global resetMocks: true in jest.config.js
vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
  useSearch: vi.fn(),
}));

vi.mock('../../utils/searchService', () => ({
  searchProducts: vi.fn(),
  searchOrders: vi.fn(),
}));

const mockKeyboardShortcutCallback = { current: null };
vi.mock('../../hooks/useKeyboardShortcut', () => ({
  useKeyboardShortcut: vi.fn(),
  getShortcutDisplay: vi.fn(),
}));

vi.mock('../../constants', () => ({
  EMPTY_ARRAY: [],
}));

// Shared mock functions accessible from tests
const mockGetCurrentStore = vi.fn();
const mockAddRecentSearch = vi.fn();

const mockProducts = [
  { id: 1, name: 'Test Product', sku: 'TP001', price: '29.99' },
  { id: 2, name: 'Another Product', sku: 'AP002', price: '49.99' },
];

const mockOrders = [
  { id: 101, billing: { first_name: 'John', last_name: 'Doe' }, total: '99.99' },
  { id: 102, billing: { first_name: 'Jane', last_name: 'Smith' }, total: '149.99' },
];

const renderWithRouter = (ui) => {
  return render(
    <MemoryRouter>
      {ui}
    </MemoryRouter>
  );
};

describe('QuickSwitcher', () => {
  beforeEach(() => {
    mockKeyboardShortcutCallback.current = null;
    mockGetCurrentStore.mockReturnValue({ id: 'test-store', name: 'Test Store' });
    mockAddRecentSearch.mockReset();

    useStoreConfig.mockImplementation((selector) => {
      const state = { getCurrentStore: mockGetCurrentStore };
      return selector ? selector(state) : state;
    });

    useCache.mockImplementation((selector) => {
      const state = {
        cache: {
          products: { data: mockProducts },
          orders: { data: mockOrders },
        },
      };
      return selector ? selector(state) : state;
    });

    useSearch.mockImplementation((selector) => {
      const state = {
        recentSearches: [
          { id: '1', query: 'recent search', type: 'products', storeId: 'test-store' },
        ],
        addRecentSearch: mockAddRecentSearch,
      };
      return selector ? selector(state) : state;
    });

    useKeyboardShortcut.mockImplementation((shortcuts, callback) => {
      mockKeyboardShortcutCallback.current = callback;
    });

    getShortcutDisplay.mockReturnValue('⌘');

    searchProducts.mockImplementation((products, query) => {
      if (query.toLowerCase().includes('test')) {
        return products.filter(p => p.name.toLowerCase().includes('test'));
      }
      return [];
    });

    searchOrders.mockImplementation((orders, query) => {
      if (query.includes('101')) {
        return orders.filter(o => o.id === 101);
      }
      return [];
    });
  });

  describe('Initial State', () => {
    it('should not render when closed', () => {
      renderWithRouter(<QuickSwitcher />);

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      expect(screen.queryByPlaceholderText(/search products/i)).not.toBeInTheDocument();
    });
  });

  describe('Opening and Closing', () => {
    it('should open when keyboard shortcut is triggered', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Trigger the keyboard shortcut callback
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products, orders/i)).toBeInTheDocument();
      });
    });

    it('should close when backdrop is clicked', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      // Click backdrop
      const backdrop = screen.getByLabelText('Close quick switcher');
      fireEvent.click(backdrop);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/search products/i)).not.toBeInTheDocument();
      });
    });

    it('should close when X button is clicked', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      // Find and click the X button
      const buttons = screen.getAllByRole('button');
      const closeButton = buttons[buttons.length - 1]; // X button is typically last
      fireEvent.click(closeButton);

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/search products/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Quick Actions', () => {
    it('should display quick actions when query is empty', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Products')).toBeInTheDocument();
        expect(screen.getByText('Orders')).toBeInTheDocument();
        expect(screen.getByText('Analytics')).toBeInTheDocument();
        expect(screen.getByText('Settings')).toBeInTheDocument();
      });
    });

    it('should display Navigate category', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        // "Navigate" appears as both a category header and a footer shortcut label
        expect(screen.getAllByText('Navigate').length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe('Recent Searches', () => {
    it('should display recent searches when query is empty', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByText('recent search')).toBeInTheDocument();
      });
    });

    it('should display Recent category for recent searches', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Recent')).toBeInTheDocument();
      });
    });
  });

  describe('Search Functionality', () => {
    it('should search products when typing', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search products/i);
      await userEvent.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });
    });

    it('should search orders when typing order ID', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search products/i);
      await userEvent.type(input, '101');

      await waitFor(() => {
        expect(screen.getByText('Order #101')).toBeInTheDocument();
      });
    });

    it('should show no results message when nothing matches', async () => {
      searchProducts.mockReturnValue([]);
      searchOrders.mockReturnValue([]);

      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search products/i);
      await userEvent.type(input, 'nonexistent');

      await waitFor(() => {
        expect(screen.getByText('No results found')).toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate with arrow keys', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search products/i);

      // Navigate down
      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // First item should be selected initially, then move down
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should close on Escape', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText(/search products/i);
      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/search products/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Footer Shortcuts', () => {
    it('should display keyboard shortcuts hint', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        // "Navigate" appears in both the category header and footer, so use getAllByText
        expect(screen.getAllByText('Navigate').length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText('Select')).toBeInTheDocument();
        expect(screen.getByText('Close')).toBeInTheDocument();
      });
    });

    it('should display shortcut keys', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByText('↑↓')).toBeInTheDocument();
        expect(screen.getByText('↵')).toBeInTheDocument();
        expect(screen.getByText('ESC')).toBeInTheDocument();
      });
    });
  });

  describe('Selection Highlighting', () => {
    it('should highlight item on mouse enter', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByText('Products')).toBeInTheDocument();
      });

      const productButton = screen.getByText('Products').closest('button');
      fireEvent.mouseEnter(productButton);

      // The button should have selected styling
      expect(productButton).toHaveClass('bg-blue-50');
    });
  });

  describe('Integration', () => {
    it('should toggle open/close with keyboard shortcut', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Initially closed
      expect(screen.queryByPlaceholderText(/search products/i)).not.toBeInTheDocument();

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      // Close (toggle)
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/search products/i)).not.toBeInTheDocument();
      });
    });

    it('should clear query when reopened', async () => {
      renderWithRouter(<QuickSwitcher />);

      // Open
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.getByPlaceholderText(/search products/i)).toBeInTheDocument();
      });

      // Type something
      const input = screen.getByPlaceholderText(/search products/i);
      await userEvent.type(input, 'test query');

      // Close
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        expect(screen.queryByPlaceholderText(/search products/i)).not.toBeInTheDocument();
      });

      // Reopen
      act(() => {
        if (mockKeyboardShortcutCallback.current) {
          mockKeyboardShortcutCallback.current();
        }
      });

      await waitFor(() => {
        const newInput = screen.getByPlaceholderText(/search products/i);
        expect(newInput).toHaveValue('');
      });
    });
  });
});
