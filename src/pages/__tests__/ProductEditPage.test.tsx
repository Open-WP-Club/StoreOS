import { vi, Mock } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import ProductEditPage from '../ProductEditPage';
import { createMockStore, createMockProduct } from '../../__test_utils__';
import { useStoreConfig, useCache } from '../../stores';
import WooCommerceService from '../../services/woocommerce';

// Mock stores
vi.mock('../../stores', () => ({
  useStoreConfig: vi.fn(),
  useCache: vi.fn(),
}));

// Mock service
vi.mock('../../services/woocommerce');

// Mock useProductEditForm hook
vi.mock('../../hooks/useProductEditForm', () => ({
  useProductEditForm: () => ({
    formData: {
      name: 'Test Product',
      description: '',
      short_description: '',
      sku: 'SKU-1',
      regular_price: '29.99',
      sale_price: '',
      manage_stock: true,
      stock_quantity: '50',
      stock_status: 'instock',
      weight: '',
      length: '',
      width: '',
      height: '',
      shipping_class: '',
      tax_status: 'taxable',
      tax_class: '',
      featured: false,
      catalog_visibility: 'visible',
      virtual: false,
      downloadable: false,
      purchase_note: '',
      menu_order: 0,
    },
    saving: false,
    successMessage: '',
    descriptionMode: 'visual',
    shortDescriptionMode: 'visual',
    descriptionRef: { current: null },
    shortDescriptionRef: { current: null },
    populateFormData: vi.fn(),
    handleInputChange: vi.fn(),
    handleVisualEditorBlur: vi.fn(),
    handleModeSwitch: vi.fn(),
    handleSave: vi.fn().mockResolvedValue(null),
  }),
}));

// Mock currency
vi.mock('../../utils/currency', () => ({
  formatPrice: (v: string) => `$${v}`,
}));

// Mock sub-components
vi.mock('../../components/VariationsTab', () => ({
  default: function MockVariationsTab() {
    return <div data-testid="variations-tab">Variations</div>;
  },
}));
vi.mock('../../components/ProductEditGeneralTab', () => ({
  default: function MockGeneralTab() {
    return <div data-testid="general-tab">General Tab</div>;
  },
}));
vi.mock('../../components/ProductEditInventoryTab', () => ({
  default: function MockInventoryTab() {
    return <div data-testid="inventory-tab">Inventory Tab</div>;
  },
}));
vi.mock('../../components/ProductEditShippingTab', () => ({
  default: function MockShippingTab() {
    return <div data-testid="shipping-tab">Shipping Tab</div>;
  },
}));
vi.mock('../../components/ProductEditAdvancedTab', () => ({
  default: function MockAdvancedTab() {
    return <div data-testid="advanced-tab">Advanced Tab</div>;
  },
}));

const mockStore = createMockStore();
const mockProduct = createMockProduct({ id: 10, name: 'Test Product' });
const mockGetProduct = vi.fn();

function renderWithRoute(id: string = '10') {
  return render(
    <MemoryRouter initialEntries={[`/products/${id}/edit`]}>
      <Routes>
        <Route path="/products/:id/edit" element={<ProductEditPage />} />
        <Route path="/setup" element={<div>Setup Page</div>} />
      </Routes>
    </MemoryRouter>
  );
}

describe('ProductEditPage', () => {
  beforeEach(() => {
    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => mockStore };
      return selector ? selector(state) : state;
    });

    (useCache as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { cache: { products: { data: [mockProduct] } } };
      return selector ? selector(state) : state;
    });

    mockGetProduct.mockResolvedValue({ success: true, data: mockProduct });
    (WooCommerceService as Mock).mockImplementation(function () { return {
      getProduct: mockGetProduct,
    }; });
  });

  it('should render the page with tabs', async () => {
    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('General')).toBeInTheDocument();
    });

    expect(screen.getByText('Inventory')).toBeInTheDocument();
    expect(screen.getByText('Shipping')).toBeInTheDocument();
    expect(screen.getByText('Advanced')).toBeInTheDocument();
  });

  it('should show General tab by default', async () => {
    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByTestId('general-tab')).toBeInTheDocument();
    });
  });

  it('should redirect to setup when no store', async () => {
    (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
      const state = { getCurrentStore: () => undefined };
      return selector ? selector(state) : state;
    });

    renderWithRoute();

    await waitFor(() => {
      expect(screen.getByText('Setup Page')).toBeInTheDocument();
    });
  });

  it('should load product from cache', async () => {
    renderWithRoute('10');

    await waitFor(() => {
      expect(screen.getByTestId('general-tab')).toBeInTheDocument();
    });
  });
});
