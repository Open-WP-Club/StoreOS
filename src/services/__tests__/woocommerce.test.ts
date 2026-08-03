import { vi } from 'vitest';
import WooCommerceService from '../woocommerce';
import { createMockStore, createMockOrder, createMockProduct, createMockCustomer } from '../../__test_utils__';

const { mockGet, mockPost, mockPut, mockDelete, MockApiConstructor } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockPut: vi.fn(),
  mockDelete: vi.fn(),
  MockApiConstructor: vi.fn(),
}));

vi.mock('@woocommerce/woocommerce-rest-api', () => ({
  __esModule: true,
  default: MockApiConstructor,
}));

vi.mock('../../utils/urlPatterns', () => ({
  normalizeStoreUrl: (url: string) => url,
}));

describe('WooCommerceService', () => {
  const mockStore = createMockStore();
  let service: WooCommerceService;

  beforeEach(() => {
    // resetMocks clears mockImplementation between tests, so re-set it here
    MockApiConstructor.mockImplementation(function () {
      return {
        get: mockGet,
        post: mockPost,
        put: mockPut,
        delete: mockDelete,
      };
    });

    service = new WooCommerceService(mockStore);
  });

  describe('constructor', () => {
    it('should throw error when no store config provided', () => {
      expect(() => new WooCommerceService(null as never)).toThrow('Store configuration is required');
    });

    it('should create service with valid store config', () => {
      expect(() => new WooCommerceService(mockStore)).not.toThrow();
    });
  });

  // ============================================
  // Connection
  // ============================================

  describe('testConnection', () => {
    it('should return success on valid connection', async () => {
      const mockStatus = { environment: { version: '9.0.0' } };
      mockGet.mockResolvedValue({ data: mockStatus, headers: {} });

      const result = await service.testConnection();

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toEqual(mockStatus);
    });

    it('should return error on connection failure', async () => {
      mockGet.mockRejectedValue({
        response: { data: { message: 'Unauthorized' } },
      });

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.error).toBe('Unauthorized');
    });

    it('should handle unknown error structure', async () => {
      mockGet.mockRejectedValue({});

      const result = await service.testConnection();

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.error).toBe('Unknown error');
    });
  });

  // ============================================
  // Orders
  // ============================================

  describe('getOrders', () => {
    it('should fetch orders successfully', async () => {
      const orders = [createMockOrder(), createMockOrder()];
      mockGet.mockResolvedValue({ data: orders, headers: { 'x-wp-total': '2' } });

      const result = await service.getOrders({ status: 'processing' });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toHaveLength(2);
      expect(mockGet).toHaveBeenCalledWith('orders', { status: 'processing' });
    });

    it('should return error on failure', async () => {
      mockGet.mockRejectedValue({ message: 'Network error' });

      const result = await service.getOrders();

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.error).toBe('Network error');
    });
  });

  describe('getAllOrders', () => {
    it('should fetch all orders with pagination', async () => {
      const orders1 = [createMockOrder(), createMockOrder()];
      const orders2 = [createMockOrder()];

      mockGet
        .mockResolvedValueOnce({ data: orders1, headers: { 'x-wp-totalpages': '2', 'x-wp-total': '3' } })
        .mockResolvedValueOnce({ data: orders2, headers: { 'x-wp-totalpages': '2', 'x-wp-total': '3' } });

      const result = await service.getAllOrders({ per_page: 2 });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toHaveLength(3);
    });

    it('should call onBatchLoaded callback', async () => {
      const orders = [createMockOrder()];
      mockGet.mockResolvedValue({ data: orders, headers: { 'x-wp-totalpages': '1', 'x-wp-total': '1' } });

      const onBatch = vi.fn();
      await service.getAllOrders({ per_page: 25 }, onBatch);

      expect(onBatch).toHaveBeenCalledWith(expect.objectContaining({
        currentPage: 1,
        totalPages: 1,
        progress: 100,
        batchData: orders,
      }));
    });

    it('should support cancellation', async () => {
      mockGet.mockResolvedValue({ data: [createMockOrder()], headers: { 'x-wp-totalpages': '3', 'x-wp-total': '75' } });

      let callCount = 0;
      const result = await service.getAllOrders({ per_page: 25 }, null, {
        cancelCheck: () => {
          callCount++;
          return callCount > 1;
        },
      });

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.cancelled).toBe(true);
    });

    it('should handle empty data response', async () => {
      mockGet.mockResolvedValue({ data: null, headers: {} });

      const result = await service.getAllOrders();

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.error).toBe('No data received');
    });
  });

  describe('getOrder', () => {
    it('should fetch a single order', async () => {
      const order = createMockOrder({ id: 42 });
      mockGet.mockResolvedValue({ data: order, headers: {} });

      const result = await service.getOrder(42);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toEqual(order);
      expect(mockGet).toHaveBeenCalledWith('orders/42');
    });

    it('should return error on failure', async () => {
      mockGet.mockRejectedValue({ response: { data: { message: 'Order not found' } } });

      const result = await service.getOrder(999);

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.error).toBe('Order not found');
    });
  });

  describe('updateOrder', () => {
    it('should update an order', async () => {
      const updatedOrder = createMockOrder({ id: 42, status: 'completed' });
      mockPut.mockResolvedValue({ data: updatedOrder, headers: {} });

      const result = await service.updateOrder(42, { status: 'completed' });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data!.status).toBe('completed');
      expect(mockPut).toHaveBeenCalledWith('orders/42', { status: 'completed' });
    });
  });

  describe('deleteOrder', () => {
    it('should delete an order', async () => {
      const order = createMockOrder({ id: 42 });
      mockDelete.mockResolvedValue({ data: order, headers: {} });

      const result = await service.deleteOrder(42);

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('orders/42', { force: true });
    });
  });

  describe('createOrder', () => {
    it('should create an order', async () => {
      const newOrder = createMockOrder({ id: 100 });
      mockPost.mockResolvedValue({ data: newOrder, headers: {} });

      const orderData = { status: 'completed', line_items: [] };
      const result = await service.createOrder(orderData);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data!.id).toBe(100);
      expect(mockPost).toHaveBeenCalledWith('orders', orderData);
    });
  });

  describe('refundOrder', () => {
    it('should create a full refund', async () => {
      mockPost.mockResolvedValue({ data: { id: 1, amount: '50.00', reason: 'POS Refund' }, headers: {} });

      const result = await service.refundOrder(42);

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('orders/42/refunds', { reason: 'POS Refund' });
    });

    it('should create a partial refund with amount', async () => {
      mockPost.mockResolvedValue({ data: { id: 1, amount: '25.00', reason: 'Partial' }, headers: {} });

      const result = await service.refundOrder(42, 25, 'Partial');

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('orders/42/refunds', {
        reason: 'Partial',
        amount: '25',
      });
    });

    it('should handle refund error', async () => {
      mockPost.mockRejectedValue({ message: 'Cannot refund' });

      const result = await service.refundOrder(42);

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.error).toBe('Cannot refund');
    });
  });

  // ============================================
  // Order Notes
  // ============================================

  describe('getOrderNotes', () => {
    it('should fetch order notes', async () => {
      const notes = [{ id: 1, note: 'Test', author: 'admin' }];
      mockGet.mockResolvedValue({ data: notes, headers: {} });

      const result = await service.getOrderNotes(42);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toEqual(notes);
      expect(mockGet).toHaveBeenCalledWith('orders/42/notes');
    });
  });

  describe('addOrderNote', () => {
    it('should add a private note', async () => {
      const note = { id: 1, note: 'Test note', customer_note: false };
      mockPost.mockResolvedValue({ data: note, headers: {} });

      const result = await service.addOrderNote(42, 'Test note');

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('orders/42/notes', {
        note: 'Test note',
        customer_note: false,
      });
    });

    it('should add a customer note', async () => {
      const note = { id: 2, note: 'Customer note', customer_note: true };
      mockPost.mockResolvedValue({ data: note, headers: {} });

      const result = await service.addOrderNote(42, 'Customer note', true);

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('orders/42/notes', {
        note: 'Customer note',
        customer_note: true,
      });
    });
  });

  describe('deleteOrderNote', () => {
    it('should delete a note', async () => {
      mockDelete.mockResolvedValue({ data: { id: 1 }, headers: {} });

      const result = await service.deleteOrderNote(42, 1);

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('orders/42/notes/1', { force: true });
    });
  });

  // ============================================
  // Products
  // ============================================

  describe('getProducts', () => {
    it('should fetch products', async () => {
      const products = [createMockProduct(), createMockProduct()];
      mockGet.mockResolvedValue({ data: products, headers: { 'x-wp-total': '2' } });

      const result = await service.getProducts({ per_page: 25 });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getAllProducts', () => {
    it('should fetch all products with pagination', async () => {
      const batch1 = [createMockProduct()];
      const batch2 = [createMockProduct()];

      mockGet
        .mockResolvedValueOnce({ data: batch1, headers: { 'x-wp-totalpages': '2', 'x-wp-total': '2' } })
        .mockResolvedValueOnce({ data: batch2, headers: { 'x-wp-totalpages': '2', 'x-wp-total': '2' } });

      const result = await service.getAllProducts({ per_page: 1 });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toHaveLength(2);
    });
  });

  describe('getProductsSince', () => {
    it('should fetch products modified since timestamp', async () => {
      const products = [createMockProduct()];
      mockGet.mockResolvedValue({ data: products, headers: { 'x-wp-totalpages': '1', 'x-wp-total': '1' } });

      const result = await service.getProductsSince('2025-01-01T00:00:00.000Z');

      expect(result.success).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('products', expect.objectContaining({
        modified_after: '2025-01-01T00:00:00.000Z',
        orderby: 'modified',
        order: 'desc',
        page: 1,
      }));
    });
  });

  describe('getProduct', () => {
    it('should fetch a single product', async () => {
      const product = createMockProduct({ id: 10 });
      mockGet.mockResolvedValue({ data: product, headers: {} });

      const result = await service.getProduct(10);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data!.id).toBe(10);
    });
  });

  describe('updateProduct', () => {
    it('should update a product', async () => {
      const updated = createMockProduct({ id: 10, name: 'Updated' });
      mockPut.mockResolvedValue({ data: updated, headers: {} });

      const result = await service.updateProduct(10, { name: 'Updated' });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data!.name).toBe('Updated');
    });
  });

  describe('createProduct', () => {
    it('should create a product', async () => {
      const newProduct = createMockProduct({ id: 99 });
      mockPost.mockResolvedValue({ data: newProduct, headers: {} });

      const result = await service.createProduct({ name: 'New Product' });

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('products', { name: 'New Product' });
    });
  });

  describe('deleteProduct', () => {
    it('should delete a product', async () => {
      const product = createMockProduct({ id: 10 });
      mockDelete.mockResolvedValue({ data: product, headers: {} });

      const result = await service.deleteProduct(10);

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('products/10', { force: true });
    });
  });

  // ============================================
  // Batch Operations
  // ============================================

  describe('batchUpdateProducts', () => {
    it('should batch update products', async () => {
      const updated = [createMockProduct({ id: 1 }), createMockProduct({ id: 2 })];
      mockPost.mockResolvedValue({ data: { update: updated }, headers: {} });

      const updates = [
        { id: 1, regular_price: '10.00' },
        { id: 2, regular_price: '20.00' },
      ];
      const result = await service.batchUpdateProducts(updates);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data!.update).toHaveLength(2);
      expect(mockPost).toHaveBeenCalledWith('products/batch', { update: updates });
    });

    it('should handle single update (not array)', async () => {
      mockPost.mockResolvedValue({ data: { update: [createMockProduct()] }, headers: {} });

      const result = await service.batchUpdateProducts({ id: 1, regular_price: '10.00' });

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('products/batch', {
        update: [{ id: 1, regular_price: '10.00' }],
      });
    });
  });

  describe('batchUpdateProductsChunked', () => {
    it('should chunk large updates', async () => {
      const updated = createMockProduct();
      mockPost.mockResolvedValue({ data: { update: [updated] }, headers: {} });

      const updates = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        regular_price: '10.00',
      }));

      const onProgress = vi.fn();
      const result = await service.batchUpdateProductsChunked(updates, onProgress);

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledTimes(2); // 100 + 50 = 2 chunks
      expect(onProgress).toHaveBeenCalled();
    });

    it('should collect errors from failed chunks', async () => {
      // First chunk succeeds, second chunk fails (batchUpdateProducts catches internally)
      mockPost
        .mockResolvedValueOnce({ data: { update: [createMockProduct()] }, headers: {} })
        .mockRejectedValueOnce({ message: 'Server error' });

      const updates = Array.from({ length: 150 }, (_, i) => ({
        id: i + 1,
        regular_price: '10.00',
      }));

      const result = await service.batchUpdateProductsChunked(updates);

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      // batchUpdateProductsChunked attaches partial `data` to its error response
      // (see the `as unknown as ApiResponse<...>` cast in products.ts) so callers
      // can inspect which items succeeded before the failure.
      const resultWithData = result as unknown as { data: { errors: string[] } };
      expect(resultWithData.data.errors).toContain('Server error');
    });
  });

  describe('batchUpdateOrders', () => {
    it('should batch update orders', async () => {
      mockPost.mockResolvedValue({ data: { update: [] }, headers: {} });

      const updates = [
        { id: 1, status: 'completed' as const },
        { id: 2, status: 'completed' as const },
      ];
      const result = await service.batchUpdateOrders(updates);

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('orders/batch', { update: updates });
    });
  });

  // ============================================
  // Optimized Queries
  // ============================================

  describe('getOrdersMinimal', () => {
    it('should fetch orders with limited fields', async () => {
      mockGet.mockResolvedValue({ data: [{ id: 1, status: 'processing' }], headers: {} });

      const result = await service.getOrdersMinimal();

      expect(result.success).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('orders', expect.objectContaining({
        _fields: 'id,status,total,billing,date_created,line_items,currency',
      }));
    });
  });

  describe('getProductsMinimal', () => {
    it('should fetch products with limited fields', async () => {
      mockGet.mockResolvedValue({ data: [{ id: 1, name: 'Test' }], headers: {} });

      const result = await service.getProductsMinimal();

      expect(result.success).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('products', expect.objectContaining({
        _fields: expect.stringContaining('id,name,sku'),
      }));
    });
  });

  // ============================================
  // Inventory
  // ============================================

  describe('updateStock', () => {
    it('should update stock quantity', async () => {
      const product = createMockProduct({ stock_quantity: 100 });
      mockPut.mockResolvedValue({ data: product, headers: {} });

      const result = await service.updateStock(10, 100);

      expect(result.success).toBe(true);
      expect(mockPut).toHaveBeenCalledWith('products/10', {
        stock_quantity: 100,
        stock_status: 'instock',
        manage_stock: true,
      });
    });

    it('should update stock with custom status', async () => {
      const product = createMockProduct({ stock_status: 'outofstock' });
      mockPut.mockResolvedValue({ data: product, headers: {} });

      const result = await service.updateStock(10, 0, 'outofstock');

      expect(result.success).toBe(true);
      expect(mockPut).toHaveBeenCalledWith('products/10', {
        stock_quantity: 0,
        stock_status: 'outofstock',
        manage_stock: true,
      });
    });
  });

  describe('getLowStockProducts', () => {
    it('should return products with stock below threshold', async () => {
      const products = [
        createMockProduct({ stock_quantity: 3 }),
        createMockProduct({ stock_quantity: 50 }),
        createMockProduct({ stock_quantity: 1 }),
      ];
      mockGet.mockResolvedValue({
        data: products,
        headers: { 'x-wp-totalpages': '1', 'x-wp-total': '3' },
      });

      const result = await service.getLowStockProducts(5);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toHaveLength(2);
    });

    it('should use default threshold of 5', async () => {
      const products = [createMockProduct({ stock_quantity: 4 })];
      mockGet.mockResolvedValue({
        data: products,
        headers: { 'x-wp-totalpages': '1', 'x-wp-total': '1' },
      });

      const result = await service.getLowStockProducts();

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toHaveLength(1);
    });
  });

  // ============================================
  // Customers
  // ============================================

  describe('getCustomers', () => {
    it('should fetch customers', async () => {
      const customers = [createMockCustomer()];
      mockGet.mockResolvedValue({ data: customers, headers: {} });

      const result = await service.getCustomers({ per_page: 10 });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toHaveLength(1);
    });
  });

  describe('getAllCustomers', () => {
    it('should fetch all customers with pagination', async () => {
      mockGet.mockResolvedValue({
        data: [createMockCustomer()],
        headers: { 'x-wp-totalpages': '1', 'x-wp-total': '1' },
      });

      const result = await service.getAllCustomers({ per_page: 25 });

      expect(result.success).toBe(true);
    });
  });

  describe('getCustomer', () => {
    it('should fetch a single customer', async () => {
      const customer = createMockCustomer({ id: 5 });
      mockGet.mockResolvedValue({ data: customer, headers: {} });

      const result = await service.getCustomer(5);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data!.id).toBe(5);
    });
  });

  describe('updateCustomer', () => {
    it('should update a customer', async () => {
      const customer = createMockCustomer({ id: 5, first_name: 'Updated' });
      mockPut.mockResolvedValue({ data: customer, headers: {} });

      const result = await service.updateCustomer(5, { first_name: 'Updated' });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data!.first_name).toBe('Updated');
    });
  });

  describe('getCustomerOrders', () => {
    it('should fetch orders for a customer', async () => {
      const orders = [createMockOrder()];
      mockGet.mockResolvedValue({ data: orders, headers: {} });

      const result = await service.getCustomerOrders(5);

      expect(result.success).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('orders', { customer: 5 });
    });
  });

  // ============================================
  // Product Variations
  // ============================================

  describe('getProductVariations', () => {
    it('should fetch variations for a product', async () => {
      const variations = [{ id: 1, sku: 'VAR-1' }];
      mockGet.mockResolvedValue({ data: variations, headers: {} });

      const result = await service.getProductVariations(10);

      expect(result.success).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('products/10/variations', { per_page: 100 });
    });
  });

  describe('createProductVariation', () => {
    it('should create a variation', async () => {
      mockPost.mockResolvedValue({ data: { id: 1 }, headers: {} });

      const result = await service.createProductVariation(10, { regular_price: '10.00' });

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('products/10/variations', { regular_price: '10.00' });
    });
  });

  describe('updateProductVariation', () => {
    it('should update a variation', async () => {
      mockPut.mockResolvedValue({ data: { id: 1, regular_price: '15.00' }, headers: {} });

      const result = await service.updateProductVariation(10, 1, { regular_price: '15.00' });

      expect(result.success).toBe(true);
      expect(mockPut).toHaveBeenCalledWith('products/10/variations/1', { regular_price: '15.00' });
    });
  });

  describe('deleteProductVariation', () => {
    it('should delete a variation', async () => {
      mockDelete.mockResolvedValue({ data: { id: 1 }, headers: {} });

      const result = await service.deleteProductVariation(10, 1);

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('products/10/variations/1', { force: true });
    });
  });

  describe('batchProductVariations', () => {
    it('should batch operate on variations', async () => {
      mockPost.mockResolvedValue({ data: { create: [], update: [], delete: [] }, headers: {} });

      const result = await service.batchProductVariations(10, {
        create: [{ regular_price: '10.00' }],
        delete: [5],
      });

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('products/10/variations/batch', {
        create: [{ regular_price: '10.00' }],
        delete: [5],
      });
    });
  });

  // ============================================
  // Coupons
  // ============================================

  describe('getCoupons', () => {
    it('should fetch coupons', async () => {
      mockGet.mockResolvedValue({ data: [{ id: 1, code: 'SAVE10' }], headers: {} });

      const result = await service.getCoupons();

      expect(result.success).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('coupons', {});
    });
  });

  describe('getAllCoupons', () => {
    it('should fetch all coupons with pagination', async () => {
      mockGet.mockResolvedValue({
        data: [{ id: 1, code: 'SAVE10' }],
        headers: { 'x-wp-totalpages': '1', 'x-wp-total': '1' },
      });

      const result = await service.getAllCoupons({ per_page: 25 });

      expect(result.success).toBe(true);
    });
  });

  describe('getCoupon', () => {
    it('should fetch a single coupon', async () => {
      mockGet.mockResolvedValue({ data: { id: 1, code: 'SAVE10' }, headers: {} });

      const result = await service.getCoupon(1);

      expect(result.success).toBe(true);
    });
  });

  describe('createCoupon', () => {
    it('should create a coupon', async () => {
      mockPost.mockResolvedValue({ data: { id: 1, code: 'NEW10' }, headers: {} });

      const result = await service.createCoupon({ code: 'NEW10', discount_type: 'percent', amount: '10' });

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('coupons', { code: 'NEW10', discount_type: 'percent', amount: '10' });
    });
  });

  describe('updateCoupon', () => {
    it('should update a coupon', async () => {
      mockPut.mockResolvedValue({ data: { id: 1, amount: '20' }, headers: {} });

      const result = await service.updateCoupon(1, { amount: '20' });

      expect(result.success).toBe(true);
    });
  });

  describe('deleteCoupon', () => {
    it('should delete a coupon', async () => {
      mockDelete.mockResolvedValue({ data: { id: 1 }, headers: {} });

      const result = await service.deleteCoupon(1);

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('coupons/1', { force: true });
    });
  });

  describe('batchUpdateCoupons', () => {
    it('should batch update coupons', async () => {
      mockPost.mockResolvedValue({ data: { update: [] }, headers: {} });

      const result = await service.batchUpdateCoupons([{ id: 1, amount: '15' }]);

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('coupons/batch', { update: [{ id: 1, amount: '15' }] });
    });
  });

  // ============================================
  // Product Reviews
  // ============================================

  describe('getReviews', () => {
    it('should fetch reviews', async () => {
      const mockReviews = [{ id: 1, reviewer: 'John', rating: 5 }];
      mockGet.mockResolvedValue({ data: mockReviews, headers: {} });

      const result = await service.getReviews();

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toEqual(mockReviews);
      expect(mockGet).toHaveBeenCalledWith('products/reviews', { per_page: 50 });
    });

    it('should handle error', async () => {
      mockGet.mockRejectedValue({ response: { data: { message: 'Forbidden' } } });

      const result = await service.getReviews();

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.error).toBe('Forbidden');
    });
  });

  describe('getReview', () => {
    it('should fetch a single review', async () => {
      const mockReview = { id: 1, reviewer: 'John', rating: 5 };
      mockGet.mockResolvedValue({ data: mockReview, headers: {} });

      const result = await service.getReview(1);

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toEqual(mockReview);
      expect(mockGet).toHaveBeenCalledWith('products/reviews/1');
    });
  });

  describe('updateReview', () => {
    it('should update review status', async () => {
      const updated = { id: 1, status: 'approved', reviewer: 'John', rating: 5 };
      mockPut.mockResolvedValue({ data: updated, headers: {} });

      const result = await service.updateReview(1, { status: 'approved' });

      expect(result.success).toBe(true);
      if (!result.success) throw new Error('Expected success');
      expect(result.data).toEqual(updated);
      expect(mockPut).toHaveBeenCalledWith('products/reviews/1', { status: 'approved' });
    });

    it('should handle error on update', async () => {
      mockPut.mockRejectedValue({ message: 'Not found' });

      const result = await service.updateReview(999, { status: 'approved' });

      expect(result.success).toBe(false);
      if (result.success) throw new Error('Expected failure');
      expect(result.error).toBe('Not found');
    });
  });

  describe('deleteReview', () => {
    it('should delete a review', async () => {
      const deleted = { id: 1 };
      mockDelete.mockResolvedValue({ data: deleted, headers: {} });

      const result = await service.deleteReview(1);

      expect(result.success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('products/reviews/1', { force: true });
    });
  });

  describe('batchUpdateReviews', () => {
    it('should batch update reviews', async () => {
      const batchResult = { update: [{ id: 1, status: 'approved' }] };
      mockPost.mockResolvedValue({ data: batchResult, headers: {} });

      const result = await service.batchUpdateReviews([{ id: 1, status: 'approved' }]);

      expect(result.success).toBe(true);
      expect(mockPost).toHaveBeenCalledWith('products/reviews/batch', {
        update: [{ id: 1, status: 'approved' }],
      });
    });
  });
});
