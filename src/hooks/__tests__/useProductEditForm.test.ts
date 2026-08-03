import { vi, Mock } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useProductEditForm } from '../useProductEditForm';
import { createMockStore, createMockProduct } from '../../__test_utils__/mockFactories';
import type { WooCommerceStore, Product } from '../../types';
import WooCommerceService from '../../services/woocommerce';
import { useStoreConfig } from '../../stores';

// ============================================
// Mocks
// ============================================

vi.mock('../../services/woocommerce');
vi.mock('../../stores');

// ============================================
// Setup
// ============================================

let mockActiveStore: WooCommerceStore | undefined;
const mockUpdateProduct = vi.fn();

beforeEach(() => {
  vi.useFakeTimers();
  mockActiveStore = createMockStore();

  (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { getCurrentStore: () => mockActiveStore };
    return selector ? selector(state) : state;
  });

  (WooCommerceService as Mock).mockImplementation(function () { return {
    updateProduct: mockUpdateProduct,
  }; });
});

afterEach(() => {
  vi.useRealTimers();
});

// ============================================
// Tests
// ============================================

describe('useProductEditForm', () => {
  describe('initial state', () => {
    it('starts with empty form data', () => {
      const { result } = renderHook(() => useProductEditForm());

      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.regular_price).toBe('');
      expect(result.current.formData.manage_stock).toBe(false);
      expect(result.current.formData.stock_status).toBe('instock');
      expect(result.current.formData.tax_status).toBe('taxable');
      expect(result.current.formData.catalog_visibility).toBe('visible');
      expect(result.current.saving).toBe(false);
      expect(result.current.successMessage).toBe('');
    });

    it('starts with visual editor mode', () => {
      const { result } = renderHook(() => useProductEditForm());

      expect(result.current.descriptionMode).toBe('visual');
      expect(result.current.shortDescriptionMode).toBe('visual');
    });
  });

  describe('populateFormData', () => {
    it('populates form with product data', () => {
      const product = createMockProduct({
        name: 'Widget',
        description: '<p>A widget</p>',
        short_description: '<p>Short</p>',
        sku: 'WDG-001',
        regular_price: '29.99',
        sale_price: '19.99',
        manage_stock: true,
        stock_quantity: 42,
        stock_status: 'instock',
        weight: '1.5',
        dimensions: { length: '10', width: '5', height: '3' },
        shipping_class: 'standard',
        tax_status: 'taxable',
        tax_class: '',
        featured: true,
        catalog_visibility: 'visible',
        virtual: false,
        downloadable: false,
        purchase_note: 'Thank you!',
        menu_order: 5,
      });

      const { result } = renderHook(() => useProductEditForm());

      act(() => {
        result.current.populateFormData(product);
      });

      expect(result.current.formData.name).toBe('Widget');
      expect(result.current.formData.description).toBe('<p>A widget</p>');
      expect(result.current.formData.sku).toBe('WDG-001');
      expect(result.current.formData.regular_price).toBe('29.99');
      expect(result.current.formData.sale_price).toBe('19.99');
      expect(result.current.formData.manage_stock).toBe(true);
      expect(result.current.formData.stock_quantity).toBe('42');
      expect(result.current.formData.weight).toBe('1.5');
      expect(result.current.formData.length).toBe('10');
      expect(result.current.formData.width).toBe('5');
      expect(result.current.formData.height).toBe('3');
      expect(result.current.formData.featured).toBe(true);
      expect(result.current.formData.purchase_note).toBe('Thank you!');
      expect(result.current.formData.menu_order).toBe(5);
    });

    it('handles missing optional fields', () => {
      const product = createMockProduct({
        name: '',
        sale_price: '',
        stock_quantity: null,
        dimensions: { length: '', width: '', height: '' },
        purchase_note: '',
      });

      const { result } = renderHook(() => useProductEditForm());

      act(() => {
        result.current.populateFormData(product);
      });

      expect(result.current.formData.name).toBe('');
      expect(result.current.formData.sale_price).toBe('');
      expect(result.current.formData.stock_quantity).toBe('');
      expect(result.current.formData.length).toBe('');
    });
  });

  describe('handleInputChange', () => {
    it('updates text input', () => {
      const { result } = renderHook(() => useProductEditForm());

      const event = {
        target: { name: 'name', value: 'New Name', type: 'text' },
      } as React.ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleInputChange(event);
      });

      expect(result.current.formData.name).toBe('New Name');
    });

    it('updates checkbox input using checked property', () => {
      const { result } = renderHook(() => useProductEditForm());

      const event = {
        target: { name: 'manage_stock', checked: true, type: 'checkbox' },
      } as React.ChangeEvent<HTMLInputElement>;

      act(() => {
        result.current.handleInputChange(event);
      });

      expect(result.current.formData.manage_stock).toBe(true);
    });

    it('updates select input', () => {
      const { result } = renderHook(() => useProductEditForm());

      const event = {
        target: { name: 'stock_status', value: 'outofstock', type: 'select-one' },
      } as React.ChangeEvent<HTMLSelectElement>;

      act(() => {
        result.current.handleInputChange(event);
      });

      expect(result.current.formData.stock_status).toBe('outofstock');
    });
  });

  describe('handleVisualEditorBlur', () => {
    it('reads innerHTML from description ref', () => {
      const { result } = renderHook(() => useProductEditForm());

      Object.defineProperty(result.current.descriptionRef, 'current', {
        value: { innerHTML: '<p>Updated content</p>' },
        writable: true,
      });

      act(() => {
        result.current.handleVisualEditorBlur('description');
      });

      expect(result.current.formData.description).toBe('<p>Updated content</p>');
    });

    it('reads innerHTML from short_description ref', () => {
      const { result } = renderHook(() => useProductEditForm());

      Object.defineProperty(result.current.shortDescriptionRef, 'current', {
        value: { innerHTML: '<p>Short updated</p>' },
        writable: true,
      });

      act(() => {
        result.current.handleVisualEditorBlur('short_description');
      });

      expect(result.current.formData.short_description).toBe('<p>Short updated</p>');
    });

    it('does nothing when ref is null', () => {
      const { result } = renderHook(() => useProductEditForm());

      act(() => {
        result.current.handleVisualEditorBlur('description');
      });

      expect(result.current.formData.description).toBe('');
    });
  });

  describe('handleModeSwitch', () => {
    it('saves innerHTML when switching from visual to code', () => {
      const { result } = renderHook(() => useProductEditForm());

      Object.defineProperty(result.current.descriptionRef, 'current', {
        value: { innerHTML: '<p>Visual content</p>' },
        writable: true,
      });

      act(() => {
        result.current.handleModeSwitch('description', 'code');
      });

      expect(result.current.descriptionMode).toBe('code');
      expect(result.current.formData.description).toBe('<p>Visual content</p>');
    });

    it('switches to visual without saving', () => {
      const { result } = renderHook(() => useProductEditForm());

      act(() => {
        result.current.handleModeSwitch('description', 'visual');
      });

      expect(result.current.descriptionMode).toBe('visual');
    });

    it('works for short_description field', () => {
      const { result } = renderHook(() => useProductEditForm());

      Object.defineProperty(result.current.shortDescriptionRef, 'current', {
        value: { innerHTML: '<em>Short</em>' },
        writable: true,
      });

      act(() => {
        result.current.handleModeSwitch('short_description', 'code');
      });

      expect(result.current.shortDescriptionMode).toBe('code');
      expect(result.current.formData.short_description).toBe('<em>Short</em>');
    });
  });

  describe('handleSave', () => {
    it('saves product and returns updated data', async () => {
      const updatedProduct = createMockProduct({ id: 42, name: 'Updated' });
      mockUpdateProduct.mockResolvedValue({ success: true, data: updatedProduct });

      const { result } = renderHook(() => useProductEditForm());

      act(() => {
        result.current.populateFormData(createMockProduct({ id: 42, name: 'Original' }));
      });

      const savedProduct = await act(async () => {
        return await result.current.handleSave(42);
      });

      expect(savedProduct?.name).toBe('Updated');
      expect(mockUpdateProduct).toHaveBeenCalledWith(42, expect.any(Object));
      expect(result.current.successMessage).toBe('Product updated successfully!');
    });

    it('sends correct stock_quantity when manage_stock is true', async () => {
      mockUpdateProduct.mockResolvedValue({ success: true, data: createMockProduct() });

      const { result } = renderHook(() => useProductEditForm());

      act(() => {
        result.current.handleInputChange({
          target: { name: 'manage_stock', checked: true, type: 'checkbox' },
        } as React.ChangeEvent<HTMLInputElement>);
        result.current.handleInputChange({
          target: { name: 'stock_quantity', value: '25', type: 'text' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSave(1);
      });

      const updateData = mockUpdateProduct.mock.calls[0]![1];
      expect(updateData.stock_quantity).toBe(25);
      expect(updateData.manage_stock).toBe(true);
    });

    it('sends null stock_quantity when manage_stock is false', async () => {
      mockUpdateProduct.mockResolvedValue({ success: true, data: createMockProduct() });

      const { result } = renderHook(() => useProductEditForm());

      await act(async () => {
        await result.current.handleSave(1);
      });

      const updateData = mockUpdateProduct.mock.calls[0]![1];
      expect(updateData.stock_quantity).toBeNull();
    });

    it('constructs dimensions object from separate fields', async () => {
      mockUpdateProduct.mockResolvedValue({ success: true, data: createMockProduct() });

      const { result } = renderHook(() => useProductEditForm());

      act(() => {
        result.current.handleInputChange({
          target: { name: 'length', value: '15', type: 'text' },
        } as React.ChangeEvent<HTMLInputElement>);
        result.current.handleInputChange({
          target: { name: 'width', value: '10', type: 'text' },
        } as React.ChangeEvent<HTMLInputElement>);
        result.current.handleInputChange({
          target: { name: 'height', value: '5', type: 'text' },
        } as React.ChangeEvent<HTMLInputElement>);
      });

      await act(async () => {
        await result.current.handleSave(1);
      });

      const updateData = mockUpdateProduct.mock.calls[0]![1];
      expect(updateData.dimensions).toEqual({
        length: '15',
        width: '10',
        height: '5',
      });
    });

    it('returns null without store', async () => {
      mockActiveStore = undefined;

      const { result } = renderHook(() => useProductEditForm());

      let savedProduct: Product | null = null;
      await act(async () => {
        savedProduct = await result.current.handleSave(1);
      });

      expect(savedProduct).toBeNull();
      expect(mockUpdateProduct).not.toHaveBeenCalled();
    });

    it('throws error on API failure', async () => {
      mockUpdateProduct.mockResolvedValue({ success: false, error: 'Invalid data' });

      const { result } = renderHook(() => useProductEditForm());

      await expect(
        act(async () => {
          await result.current.handleSave(1);
        })
      ).rejects.toThrow('Invalid data');
    });

    it('clears success message after 3 seconds', async () => {
      mockUpdateProduct.mockResolvedValue({ success: true, data: createMockProduct() });

      const { result } = renderHook(() => useProductEditForm());

      await act(async () => {
        await result.current.handleSave(1);
      });

      expect(result.current.successMessage).toBe('Product updated successfully!');

      act(() => {
        vi.advanceTimersByTime(3000);
      });

      expect(result.current.successMessage).toBe('');
    });

    it('resets saving flag after completion', async () => {
      mockUpdateProduct.mockResolvedValue({ success: true, data: createMockProduct() });

      const { result } = renderHook(() => useProductEditForm());

      await act(async () => {
        await result.current.handleSave(1);
      });

      expect(result.current.saving).toBe(false);
    });

    it('resets saving flag even on failure', async () => {
      mockUpdateProduct.mockResolvedValue({ success: false, error: 'Error' });

      const { result } = renderHook(() => useProductEditForm());

      try {
        await act(async () => {
          await result.current.handleSave(1);
        });
      } catch {
        // Expected to throw
      }

      expect(result.current.saving).toBe(false);
    });
  });
});
