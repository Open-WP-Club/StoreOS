import { vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { usePOSVariants } from '../usePOSVariants';
import WooCommerceService from '../../services/woocommerce';

// Mock stores
vi.mock('../../stores', () => ({
  useStoreConfig: (selector) =>
    selector({
      getCurrentStore: () => ({
        url: 'https://example.com',
        consumerKey: 'ck_test',
        consumerSecret: 'cs_test',
      }),
    }),
}));

const mockToast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() }));
vi.mock('../../contexts/ToastContext', () => ({ useToast: () => mockToast }));

// Mock WooCommerceService
vi.mock('../../services/woocommerce');

const mockVariations = [
  {
    id: 101,
    sku: 'TSH-RED-M',
    price: '20.00',
    regular_price: '25.00',
    sale_price: '20.00',
    stock_status: 'instock',
    stock_quantity: 5,
    manage_stock: true,
    image: { src: 'https://example.com/red.jpg' },
    attributes: [
      { name: 'Color', option: 'Red' },
      { name: 'Size', option: 'M' },
    ],
  },
  {
    id: 102,
    sku: 'TSH-BLU-L',
    price: '22.00',
    regular_price: '22.00',
    sale_price: '',
    stock_status: 'instock',
    stock_quantity: 3,
    manage_stock: true,
    image: null,
    attributes: [],
  },
];

const mockSimpleProduct = {
  id: 1,
  name: 'Simple Product',
  type: 'simple',
  price: '15.00',
  regular_price: '15.00',
  sale_price: '',
  images: [{ src: 'https://example.com/simple.jpg' }],
};

const mockVariableProduct = {
  id: 2,
  name: 'T-Shirt',
  type: 'variable',
  price: '20.00',
  regular_price: '25.00',
  sale_price: '20.00',
  variations: [101, 102],
  images: [{ src: 'https://example.com/tshirt.jpg' }],
};

describe('usePOSVariants', () => {
  let mockAddToCart;
  let mockGetProductVariations;

  beforeEach(() => {
    mockAddToCart = vi.fn();
    mockGetProductVariations = vi.fn().mockResolvedValue({
      success: true,
      data: mockVariations,
    });
    WooCommerceService.mockImplementation(function () { return {
      getProductVariations: mockGetProductVariations,
    }; });
  });

  it('should initialize with closed variant picker', () => {
    const { result } = renderHook(() => usePOSVariants(mockAddToCart));

    expect(result.current.showVariantPicker).toBe(false);
    expect(result.current.selectedVariableProduct).toBeNull();
    expect(result.current.productVariations).toEqual([]);
    expect(result.current.loadingVariations).toBe(false);
  });

  it('should add simple products to cart directly', async () => {
    const { result } = renderHook(() => usePOSVariants(mockAddToCart));

    await act(async () => {
      await result.current.handleProductClick(mockSimpleProduct);
    });

    expect(mockAddToCart).toHaveBeenCalledWith(mockSimpleProduct);
    expect(result.current.showVariantPicker).toBe(false);
    expect(mockGetProductVariations).not.toHaveBeenCalled();
  });

  it('should open variant picker and load variations for variable products', async () => {
    const { result } = renderHook(() => usePOSVariants(mockAddToCart));

    await act(async () => {
      await result.current.handleProductClick(mockVariableProduct);
    });

    expect(result.current.showVariantPicker).toBe(true);
    expect(result.current.selectedVariableProduct).toEqual(mockVariableProduct);
    expect(result.current.productVariations).toEqual(mockVariations);
    expect(result.current.loadingVariations).toBe(false);
    expect(mockGetProductVariations).toHaveBeenCalledWith(2);
    expect(mockAddToCart).not.toHaveBeenCalled();
  });

  it('should build variation name from attributes', () => {
    const { result } = renderHook(() => usePOSVariants(mockAddToCart));

    const name = result.current.getVariationName(mockVariations[0]);
    expect(name).toBe('Red / M');
  });

  it('should fall back to ID when attributes are empty', () => {
    const { result } = renderHook(() => usePOSVariants(mockAddToCart));

    const name = result.current.getVariationName(mockVariations[1]);
    expect(name).toBe('#102');
  });

  it('should add variation to cart with merged product data', async () => {
    const { result } = renderHook(() => usePOSVariants(mockAddToCart));

    // Open variant picker
    await act(async () => {
      await result.current.handleProductClick(mockVariableProduct);
    });

    // Select a variation
    act(() => {
      result.current.handleAddVariation(mockVariations[0]);
    });

    expect(mockAddToCart).toHaveBeenCalledTimes(1);
    const addedProduct = mockAddToCart.mock.calls[0][0];
    expect(addedProduct.id).toBe(101);
    expect(addedProduct.sku).toBe('TSH-RED-M');
    expect(addedProduct.price).toBe('20.00');
    expect(addedProduct.name).toBe('T-Shirt - Red / M');
    expect(addedProduct.images).toEqual([{ src: 'https://example.com/red.jpg' }]);

    // Picker should be closed
    expect(result.current.showVariantPicker).toBe(false);
    expect(result.current.selectedVariableProduct).toBeNull();
    expect(result.current.productVariations).toEqual([]);
  });

  it('should use parent images when variation has no image', async () => {
    const { result } = renderHook(() => usePOSVariants(mockAddToCart));

    await act(async () => {
      await result.current.handleProductClick(mockVariableProduct);
    });

    act(() => {
      result.current.handleAddVariation(mockVariations[1]);
    });

    const addedProduct = mockAddToCart.mock.calls[0][0];
    expect(addedProduct.images).toEqual(mockVariableProduct.images);
  });

  it('should close variant picker and reset state', async () => {
    const { result } = renderHook(() => usePOSVariants(mockAddToCart));

    await act(async () => {
      await result.current.handleProductClick(mockVariableProduct);
    });

    expect(result.current.showVariantPicker).toBe(true);

    act(() => {
      result.current.closeVariantPicker();
    });

    expect(result.current.showVariantPicker).toBe(false);
    expect(result.current.selectedVariableProduct).toBeNull();
    expect(result.current.productVariations).toEqual([]);
  });

  it('should handle API failure gracefully', async () => {
    mockGetProductVariations.mockRejectedValueOnce(new Error('Network error'));

    const { result } = renderHook(() => usePOSVariants(mockAddToCart));

    await act(async () => {
      await result.current.handleProductClick(mockVariableProduct);
    });

    expect(result.current.showVariantPicker).toBe(true);
    expect(result.current.productVariations).toEqual([]);
    expect(result.current.loadingVariations).toBe(false);
    expect(mockToast.error).toHaveBeenCalledWith(expect.stringContaining('Грешка'));
  });
});
