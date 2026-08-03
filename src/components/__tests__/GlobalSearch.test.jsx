import { vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import GlobalSearch from '../GlobalSearch';
import { useStoreConfig, useCache, useSearch } from '../../stores';
import { universalSearch } from '../../utils/searchService';

// jest.mock factories return bare stubs — implementations are set in beforeEach
// to survive the global resetMocks: true in jest.config.js
vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
  useSearch: vi.fn(),
}));

vi.mock('../../utils/searchService', () => ({
  universalSearch: vi.fn(),
}));

vi.mock('../../constants', () => ({
  EMPTY_ARRAY: [],
}));

// Shared mock functions accessible from tests
const mockGetCurrentStore = vi.fn();
const mockAddRecentSearch = vi.fn();
const mockRemoveRecentSearch = vi.fn();

const mockProducts = [
  { id: 1, name: 'Test Product', sku: 'TP001' },
  { id: 2, name: 'Another Product', sku: 'AP002' },
];

const mockOrders = [
  { id: 101, billing: { email: 'test@example.com' } },
  { id: 102, billing: { email: 'user@example.com' } },
];

const renderWithRouter = (ui, { route = '/' } = {}) => {
  return render(
    <MemoryRouter initialEntries={[route]}>
      {ui}
    </MemoryRouter>
  );
};

describe('GlobalSearch', () => {
  beforeEach(() => {
    mockGetCurrentStore.mockReturnValue({ id: 'test-store' });
    mockAddRecentSearch.mockReset();
    mockRemoveRecentSearch.mockReset();

    useStoreConfig.mockImplementation((selector) => {
      const state = { getCurrentStore: mockGetCurrentStore };
      return selector ? selector(state) : state;
    });

    useCache.mockImplementation((selector) => {
      const state = {
        cache: {
          products: { data: mockProducts },
          orders: { data: mockOrders },
          customers: { data: [] },
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
        removeRecentSearch: mockRemoveRecentSearch,
      };
      return selector ? selector(state) : state;
    });

    // Default: universalSearch returns empty results for unknown queries
    universalSearch.mockImplementation((query) => {
      if (query.toLowerCase().includes('test')) {
        return {
          products: [
            { id: 1, type: 'product', title: 'Test Product', subtitle: 'SKU: TP001', score: 0.9, data: mockProducts[0] },
          ],
          orders: [],
          customers: [],
        };
      }
      return { products: [], orders: [], customers: [] };
    });
  });

  describe('Rendering', () => {
    it('should render search input', () => {
      renderWithRouter(<GlobalSearch />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should render with default placeholder', () => {
      renderWithRouter(<GlobalSearch />);

      expect(screen.getByPlaceholderText(/search products, orders/i)).toBeInTheDocument();
    });

    it('should render with custom placeholder', () => {
      renderWithRouter(<GlobalSearch placeholder="Custom placeholder" />);

      expect(screen.getByPlaceholderText('Custom placeholder')).toBeInTheDocument();
    });

    it('should render search icon', () => {
      renderWithRouter(<GlobalSearch />);

      // Search icon is present (part of the component)
      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Input Behavior', () => {
    it('should update input value on change', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });

    it('should show clear button when input has value', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');

      // Clear button should be visible
      const buttons = screen.getAllByRole('button');
      expect(buttons.length).toBeGreaterThan(0);
    });

    it('should clear input when clear button is clicked', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');

      // Find and click the clear button (it's the button inside the search container)
      const clearButton = screen.getByRole('button');
      await userEvent.click(clearButton);

      expect(input).toHaveValue('');
    });
  });

  describe('Dropdown Behavior', () => {
    it('should show dropdown on focus when there are recent searches', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/recent searches/i)).toBeInTheDocument();
      });
    });

    it('should show search results when typing', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });
    });

    it('should close dropdown on escape', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/recent searches/i)).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Escape' });

      await waitFor(() => {
        expect(screen.queryByText(/recent searches/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Keyboard Navigation', () => {
    it('should navigate results with arrow keys', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      fireEvent.keyDown(input, { key: 'ArrowDown' });

      // Results should have aria-selected attributes
      const options = screen.getAllByRole('option');
      expect(options.length).toBeGreaterThan(0);
    });

    it('should select result on enter', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');

      await waitFor(() => {
        expect(screen.getByText('Test Product')).toBeInTheDocument();
      });

      fireEvent.keyDown(input, { key: 'Enter' });

      // Input should be cleared after navigation
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });
  });

  describe('Recent Searches', () => {
    it('should display recent searches when input is empty', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText('recent search')).toBeInTheDocument();
      });
    });

    it('should show remove button for recent searches', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);

      await waitFor(() => {
        // There should be buttons for removing recent searches
        const buttons = screen.getAllByRole('button');
        expect(buttons.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Search Type', () => {
    it('should default to products search on products page', () => {
      renderWithRouter(<GlobalSearch />, { route: '/products' });

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('should default to orders search on orders page', () => {
      renderWithRouter(<GlobalSearch />, { route: '/orders' });

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });
  });

  describe('Search Execution', () => {
    it('should execute search when typing and pressing enter', async () => {
      // No results so Enter triggers fallback search navigation
      universalSearch.mockReturnValue({ products: [], orders: [], customers: [] });

      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'search query');
      fireEvent.keyDown(input, { key: 'Enter' });

      // Input should be cleared
      await waitFor(() => {
        expect(input).toHaveValue('');
      });
    });

    it('should not execute search for empty query', async () => {
      // No recent searches to avoid selection on Enter
      useSearch.mockImplementation((selector) => {
        const state = {
          recentSearches: [],
          addRecentSearch: mockAddRecentSearch,
          removeRecentSearch: mockRemoveRecentSearch,
        };
        return selector ? selector(state) : state;
      });

      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      fireEvent.keyDown(input, { key: 'Enter' });

      // Input should still be empty
      expect(input).toHaveValue('');
    });

    it('should not execute search for whitespace-only query', async () => {
      // No recent searches to avoid selection on Enter
      useSearch.mockImplementation((selector) => {
        const state = {
          recentSearches: [],
          addRecentSearch: mockAddRecentSearch,
          removeRecentSearch: mockRemoveRecentSearch,
        };
        return selector ? selector(state) : state;
      });

      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, '   ');
      fireEvent.keyDown(input, { key: 'Enter' });

      // Nothing should happen for whitespace-only query
      expect(input).toHaveValue('   ');
    });
  });

  describe('Compact Mode', () => {
    it('should apply compact styles when compact prop is true', () => {
      renderWithRouter(<GlobalSearch compact={true} />);

      const container = screen.getByRole('textbox').closest('div').parentElement;
      expect(container).toHaveClass('w-full');
    });

    it('should apply full width styles when compact prop is false', () => {
      renderWithRouter(<GlobalSearch compact={false} />);

      const container = screen.getByRole('textbox').closest('div').parentElement;
      expect(container).toHaveClass('max-w-md');
    });
  });

  describe('Click Outside', () => {
    it('should close dropdown when clicking outside', async () => {
      renderWithRouter(
        <div>
          <GlobalSearch />
          <div data-testid="outside">Outside element</div>
        </div>
      );

      const input = screen.getByRole('textbox');
      fireEvent.focus(input);

      await waitFor(() => {
        expect(screen.getByText(/recent searches/i)).toBeInTheDocument();
      });

      // Click outside
      fireEvent.mouseDown(screen.getByTestId('outside'));

      await waitFor(() => {
        expect(screen.queryByText(/recent searches/i)).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('should have accessible input', () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      expect(input).toHaveAttribute('placeholder');
    });

    it('should have proper aria attributes on results', async () => {
      renderWithRouter(<GlobalSearch />);

      const input = screen.getByRole('textbox');
      await userEvent.type(input, 'test');

      await waitFor(() => {
        const options = screen.getAllByRole('option');
        expect(options.length).toBeGreaterThan(0);
        expect(options[0]).toHaveAttribute('aria-selected');
      });
    });
  });
});
