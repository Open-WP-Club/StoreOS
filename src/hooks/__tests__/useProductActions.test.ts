import { vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProductActions } from '../useProductActions';
import { createMockStore, createMockProduct } from '../../__test_utils__/mockFactories';
import type { WooCommerceStore, Product } from '../../types';
import WooCommerceService from '../../services/woocommerce';
import { useStoreConfig, useCache, useSettings, useActivityLog } from '../../stores';

// ============================================
// Mocks
// ============================================

vi.mock('../../services/woocommerce');
vi.mock('../../stores');

// ============================================
// Setup
// ============================================

let mockActiveStore: WooCommerceStore | undefined;
const mockShowToast = vi.fn();
const mockUpdateProduct = vi.fn();
const mockDeleteProduct = vi.fn();
const mockBatchProducts = vi.fn();
const mockCreateProduct = vi.fn();
const mockBatchUpdateProducts = vi.fn();
const mockSetCachedData = vi.fn().mockResolvedValue(undefined);
const mockRefreshProducts = vi.fn();
const mockLogActivity = vi.fn();
const mockCacheSetState = vi.fn();

beforeEach(() => {
  mockActiveStore = createMockStore();
  window.confirm = vi.fn(() => true);

  (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { getCurrentStore: () => mockActiveStore };
    return selector ? selector(state) : state;
  });

  const cacheMock = (selector?: (state: unknown) => unknown) => {
    const state = { setCachedData: mockSetCachedData };
    return selector ? selector(state) : state;
  };
  cacheMock.setState = mockCacheSetState;
  (useCache as unknown as Mock).mockImplementation(cacheMock);
  Object.assign(useCache, { setState: mockCacheSetState });

  (useSettings as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { refreshProducts: mockRefreshProducts };
    return selector ? selector(state) : state;
  });

  (useActivityLog as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { logActivity: mockLogActivity };
    return selector ? selector(state) : state;
  });

  (WooCommerceService as Mock).mockImplementation(function () { return {
    updateProduct: mockUpdateProduct,
    deleteProduct: mockDeleteProduct,
    batchProducts: mockBatchProducts,
    createProduct: mockCreateProduct,
    batchUpdateProducts: mockBatchUpdateProducts,
  }; });
});

// ============================================
// Tests
// ============================================

describe('useProductActions', () => {
  describe('handleEdit', () => {
    it('sets edit mode and populates edit data', () => {
      const { result } = renderHook(() => useProductActions(mockShowToast));
      const product = createMockProduct({
        name: 'Widget',
        price: '19.99',
        regular_price: '24.99',
        sale_price: '19.99',
        stock_quantity: 42,
        stock_status: 'instock',
      });

      act(() => {
        result.current.handleEdit(product);
      });

      expect(result.current.editMode).toBe(true);
      expect(result.current.selectedProduct?.id).toBe(product.id);
      expect(result.current.editData.name).toBe('Widget');
      expect(result.current.editData.regular_price).toBe('24.99');
      expect(result.current.editData.stock_quantity).toBe(42);
    });

    it('handles missing optional fields with defaults', () => {
      const { result } = renderHook(() => useProductActions(mockShowToast));
      const product = createMockProduct({
        name: '',
        sale_price: '',
        stock_quantity: null,
      });

      act(() => {
        result.current.handleEdit(product);
      });

      expect(result.current.editData.name).toBe('');
      expect(result.current.editData.sale_price).toBe('');
      expect(result.current.editData.stock_quantity).toBe('');
    });
  });

  describe('handleSave', () => {
    it('updates product via API and cache', async () => {
      const product = createMockProduct({ id: 1 });
      const updatedProduct = { ...product, name: 'Updated', date_modified_gmt: '2025-01-01T00:00:00Z' };
      mockUpdateProduct.mockResolvedValue({ success: true, data: updatedProduct });

      const products = [product];
      const setProducts = vi.fn();

      const { result } = renderHook(() => useProductActions(mockShowToast));

      act(() => {
        result.current.handleEdit(product);
      });

      await act(async () => {
        await result.current.handleSave(products, setProducts);
      });

      expect(mockUpdateProduct).toHaveBeenCalledWith(product.id, expect.any(Object));
      expect(setProducts).toHaveBeenCalled();
      expect(mockSetCachedData).toHaveBeenCalledWith('products', expect.any(Array));
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'product_updated',
          entityType: 'product',
          entityId: product.id,
        })
      );
      expect(mockShowToast).toHaveBeenCalledWith('Product updated successfully', 'success');
      expect(result.current.editMode).toBe(false);
      expect(result.current.selectedProduct).toBeNull();
    });

    it('does nothing without selected product', async () => {
      const { result } = renderHook(() => useProductActions(mockShowToast));

      await act(async () => {
        await result.current.handleSave([], vi.fn());
      });

      expect(mockUpdateProduct).not.toHaveBeenCalled();
    });

    it('shows error toast on API failure', async () => {
      const product = createMockProduct({ id: 1 });
      mockUpdateProduct.mockResolvedValue({ success: false, error: 'Validation failed' });

      const { result } = renderHook(() => useProductActions(mockShowToast));

      act(() => {
        result.current.handleEdit(product);
      });

      await act(async () => {
        await result.current.handleSave([product], vi.fn());
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Validation failed'),
        'error'
      );
      expect(mockLogActivity).not.toHaveBeenCalled();
    });

    it('shows error toast on exception', async () => {
      const product = createMockProduct({ id: 1 });
      mockUpdateProduct.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useProductActions(mockShowToast));

      act(() => {
        result.current.handleEdit(product);
      });

      await act(async () => {
        await result.current.handleSave([product], vi.fn());
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Network error'),
        'error'
      );
    });
  });

  describe('handleDelete', () => {
    it('deletes product after confirmation', async () => {
      const product = createMockProduct({ id: 5 });
      mockDeleteProduct.mockResolvedValue({ success: true });

      const products = [product, createMockProduct({ id: 6 })];
      const setProducts = vi.fn();

      const { result } = renderHook(() => useProductActions(mockShowToast));

      await act(async () => {
        await result.current.handleDelete(5, products, setProducts);
      });

      expect(window.confirm).toHaveBeenCalled();
      expect(mockDeleteProduct).toHaveBeenCalledWith(5);
      expect(setProducts).toHaveBeenCalledWith([products[1]]);
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'product_deleted',
          entityType: 'product',
          entityId: 5,
        })
      );
      expect(mockShowToast).toHaveBeenCalledWith('Product deleted successfully', 'success');
    });

    it('does nothing when confirmation cancelled', async () => {
      (window.confirm as Mock).mockReturnValue(false);

      const { result } = renderHook(() => useProductActions(mockShowToast));

      await act(async () => {
        await result.current.handleDelete(5, [], vi.fn());
      });

      expect(mockDeleteProduct).not.toHaveBeenCalled();
    });

    it('shows error toast on API failure', async () => {
      mockDeleteProduct.mockResolvedValue({ success: false, error: 'Forbidden' });

      const { result } = renderHook(() => useProductActions(mockShowToast));

      await act(async () => {
        await result.current.handleDelete(5, [createMockProduct({ id: 5 })], vi.fn());
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Forbidden'),
        'error'
      );
    });
  });

  describe('handleDuplicate', () => {
    it('duplicates product with "(Copy)" name and draft status', async () => {
      const product = createMockProduct({ id: 10, name: 'Original' });
      const duplicated = createMockProduct({ id: 99, name: 'Original (Copy)', status: 'draft' });
      mockCreateProduct.mockResolvedValue({ success: true, data: duplicated });

      const products = [product];
      const setProducts = vi.fn();

      const { result } = renderHook(() => useProductActions(mockShowToast));

      await act(async () => {
        await result.current.handleDuplicate(product, products, setProducts);
      });

      expect(mockCreateProduct).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'Original (Copy)',
          status: 'draft',
          sku: '',
        })
      );
      expect(setProducts).toHaveBeenCalledWith([duplicated, product]);
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'product_created',
          entityType: 'product',
          entityId: 99,
        })
      );
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('duplicated'),
        'success'
      );
    });

    it('does nothing when confirmation cancelled', async () => {
      (window.confirm as Mock).mockReturnValue(false);

      const { result } = renderHook(() => useProductActions(mockShowToast));
      const product = createMockProduct();

      await act(async () => {
        await result.current.handleDuplicate(product, [], vi.fn());
      });

      expect(mockCreateProduct).not.toHaveBeenCalled();
    });
  });

  describe('handleQuickEditPrice', () => {
    it('updates price via API', async () => {
      const product = createMockProduct({ id: 7, regular_price: '10.00' });
      const updated = { ...product, regular_price: '15.00', date_modified_gmt: '2025-01-01T00:00:00Z' };
      mockUpdateProduct.mockResolvedValue({ success: true, data: updated });

      const products = [product];
      const setProducts = vi.fn();

      const { result } = renderHook(() => useProductActions(mockShowToast));

      act(() => {
        result.current.setQuickEditPrice('15.00');
      });

      await act(async () => {
        await result.current.handleQuickEditPrice(7, products, setProducts);
      });

      expect(mockUpdateProduct).toHaveBeenCalledWith(7, { regular_price: '15.00' });
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'product_updated',
          entityType: 'product',
          entityId: 7,
          changes: expect.objectContaining({
            regular_price: expect.objectContaining({ to: '15.00' }),
          }),
        })
      );
      expect(mockShowToast).toHaveBeenCalledWith('Price updated successfully', 'success');
      expect(result.current.quickEditId).toBeNull();
      expect(result.current.quickEditPrice).toBe('');
    });

    it('does nothing with empty price', async () => {
      const { result } = renderHook(() => useProductActions(mockShowToast));

      await act(async () => {
        await result.current.handleQuickEditPrice(7, [], vi.fn());
      });

      expect(mockUpdateProduct).not.toHaveBeenCalled();
    });

    it('resets updating flag after completion', async () => {
      const product = createMockProduct({ id: 7 });
      mockUpdateProduct.mockResolvedValue({ success: true, data: product });

      const { result } = renderHook(() => useProductActions(mockShowToast));

      act(() => {
        result.current.setQuickEditPrice('20.00');
      });

      await act(async () => {
        await result.current.handleQuickEditPrice(7, [product], vi.fn());
      });

      expect(result.current.updating).toBe(false);
    });
  });

  describe('handleBulkDelete', () => {
    it('reports partial failure and only removes deleted products', async () => {
      mockBatchProducts.mockResolvedValue({
        success: true,
        data: { delete: [{ id: 1 }, { id: 2, error: { code: 'cant', message: 'no' } }] },
      });
      const products = [
        createMockProduct({ id: 1 }),
        createMockProduct({ id: 2 }),
        createMockProduct({ id: 3 }),
      ];
      const setProducts = vi.fn();
      const { result } = renderHook(() => useProductActions(mockShowToast));
      act(() => {
        result.current.setSelectedProductIds([1, 2]);
      });

      await act(async () => {
        await result.current.handleBulkDelete(products, setProducts);
      });

      expect(setProducts).toHaveBeenCalledWith([products[1], products[2]]);
      expect(result.current.selectedProductIds).toEqual([2]);
      expect(mockShowToast).toHaveBeenCalledWith('1 of 2 products failed to delete', 'warning');
    });

    it('shows an error and keeps products when every delete fails', async () => {
      mockBatchProducts.mockResolvedValue({
        success: true,
        data: { delete: [{ id: 1, error: {} }] },
      });
      const setProducts = vi.fn();
      const { result } = renderHook(() => useProductActions(mockShowToast));
      act(() => {
        result.current.setSelectedProductIds([1]);
      });

      await act(async () => {
        await result.current.handleBulkDelete([createMockProduct({ id: 1 })], setProducts);
      });

      expect(setProducts).not.toHaveBeenCalled();
      expect(mockShowToast).toHaveBeenCalledWith(expect.stringContaining('1 of 1 failed'), 'error');
    });

    it('deletes multiple products', async () => {
      mockBatchProducts.mockResolvedValue({ success: true, data: {} });

      const products = [
        createMockProduct({ id: 1 }),
        createMockProduct({ id: 2 }),
        createMockProduct({ id: 3 }),
      ];
      const setProducts = vi.fn();

      const { result } = renderHook(() => useProductActions(mockShowToast));

      act(() => {
        result.current.setSelectedProductIds([1, 2]);
      });

      await act(async () => {
        await result.current.handleBulkDelete(products, setProducts);
      });

      expect(mockBatchProducts).toHaveBeenCalledWith({ delete: [1, 2] });
      expect(setProducts).toHaveBeenCalledWith([products[2]]);
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'product_deleted',
          entityType: 'product',
          details: expect.stringContaining('2'),
        })
      );
      expect(result.current.selectedProductIds).toHaveLength(0);
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('2'),
        'success'
      );
    });
  });

  describe('handleBulkSave', () => {
    it('batch updates products', async () => {
      const product1 = createMockProduct({ id: 1 });
      const product2 = createMockProduct({ id: 2 });
      const updated1 = { ...product1, name: 'Updated 1' };
      const updated2 = { ...product2, name: 'Updated 2' };

      mockBatchUpdateProducts.mockResolvedValue({
        success: true,
        data: { update: [updated1, updated2] },
      });

      const products = [product1, product2];
      const setProducts = vi.fn();
      const updates = [
        { id: 1, name: 'Updated 1' },
        { id: 2, name: 'Updated 2' },
      ];

      const { result } = renderHook(() => useProductActions(mockShowToast));

      act(() => {
        result.current.setSelectedProductIds([1, 2]);
      });

      await act(async () => {
        await result.current.handleBulkSave(updates, products, setProducts);
      });

      expect(mockBatchUpdateProducts).toHaveBeenCalledWith(updates);
      expect(setProducts).toHaveBeenCalled();
      expect(mockLogActivity).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'product_bulk_updated',
          entityType: 'product',
          details: expect.stringContaining('2'),
        })
      );
      expect(result.current.selectedProductIds).toHaveLength(0);
      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('2'),
        'success'
      );
    });

    it('does nothing without store', async () => {
      mockActiveStore = undefined;

      const { result } = renderHook(() => useProductActions(mockShowToast));

      await act(async () => {
        await result.current.handleBulkSave([{ id: 1 }], [], vi.fn());
      });

      expect(mockBatchUpdateProducts).not.toHaveBeenCalled();
    });
  });

  describe('selection management', () => {
    it('toggles product selection', () => {
      const { result } = renderHook(() => useProductActions(mockShowToast));

      act(() => {
        result.current.handleSelectProduct(1);
      });
      expect(result.current.selectedProductIds).toContain(1);

      act(() => {
        result.current.handleSelectProduct(1);
      });
      expect(result.current.selectedProductIds).not.toContain(1);
    });

    it('selects all products on page', () => {
      const { result } = renderHook(() => useProductActions(mockShowToast));
      const products = [
        createMockProduct({ id: 10 }),
        createMockProduct({ id: 20 }),
      ];

      act(() => {
        result.current.handleSelectAll(products, true);
      });
      expect(result.current.selectedProductIds).toEqual([10, 20]);

      act(() => {
        result.current.handleSelectAll(products, false);
      });
      expect(result.current.selectedProductIds).toHaveLength(0);
    });

    it('getSelectedProducts filters by selected IDs', () => {
      const { result } = renderHook(() => useProductActions(mockShowToast));
      const products = [
        createMockProduct({ id: 10 }),
        createMockProduct({ id: 20 }),
        createMockProduct({ id: 30 }),
      ];

      act(() => {
        result.current.setSelectedProductIds([10, 30]);
      });

      const selected = result.current.getSelectedProducts(products);
      expect(selected).toHaveLength(2);
      expect(selected.map((p: Product) => p.id)).toEqual([10, 30]);
    });
  });
});
