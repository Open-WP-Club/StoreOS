import { vi } from 'vitest';

const { mockApiInstance, MockWooCommerceRestApi } = vi.hoisted(() => {
  const mockApiInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  };
  const MockWooCommerceRestApi = vi.fn(function () {
    return mockApiInstance;
  });
  return { mockApiInstance, MockWooCommerceRestApi };
});

// Mock the dynamic import of @woocommerce/woocommerce-rest-api
vi.mock('@woocommerce/woocommerce-rest-api', () => ({
  __esModule: true,
  default: MockWooCommerceRestApi,
}));

import WooCommerceService from '../woocommerce';

describe('WooCommerceService', () => {
  const mockStoreConfig = {
    url: 'https://example.com',
    consumerKey: 'test_key',
    consumerSecret: 'test_secret',
  };

  let service;

  beforeEach(() => {
    vi.clearAllMocks();
    MockWooCommerceRestApi.mockImplementation(function () {
      return mockApiInstance;
    });
    service = new WooCommerceService(mockStoreConfig);
  });

  describe('constructor', () => {
    it('should throw error when store config is missing', () => {
      expect(() => new WooCommerceService()).toThrow('Store configuration is required');
    });

    it('should not instantiate WooCommerceRestApi in constructor (lazy init)', () => {
      // With dynamic import, the API is not created until the first API call
      expect(MockWooCommerceRestApi).not.toHaveBeenCalled();
    });
  });

  describe('testConnection', () => {
    it('should return success when connection is successful', async () => {
      const mockData = { environment: 'test' };
      mockApiInstance.get.mockResolvedValue({ data: mockData });

      const result = await service.testConnection();

      expect(mockApiInstance.get).toHaveBeenCalledWith('system_status');
      expect(result).toEqual({ success: true, data: mockData });
    });

    it('should lazily initialize the API on first call', async () => {
      mockApiInstance.get.mockResolvedValue({ data: {} });

      await service.testConnection();

      expect(MockWooCommerceRestApi).toHaveBeenCalledWith({
        url: 'https://example.com',
        consumerKey: 'test_key',
        consumerSecret: 'test_secret',
        version: 'wc/v3',
        queryStringAuth: true,
      });
    });

    it('should return error when connection fails', async () => {
      const mockError = new Error('Connection failed');
      mockError.response = { data: { message: 'API Error' } };
      mockApiInstance.get.mockRejectedValue(mockError);

      const result = await service.testConnection();

      expect(result).toEqual({ success: false, error: 'API Error' });
    });

    it('should handle errors without response data', async () => {
      const mockError = new Error('Network error');
      mockApiInstance.get.mockRejectedValue(mockError);

      const result = await service.testConnection();

      expect(result).toEqual({ success: false, error: 'Network error' });
    });
  });

  describe('getOrders', () => {
    it('should fetch orders successfully', async () => {
      const mockOrders = [{ id: 1, status: 'processing' }];
      const mockHeaders = { 'x-wp-total': '10' };
      mockApiInstance.get.mockResolvedValue({
        data: mockOrders,
        headers: mockHeaders,
      });

      const result = await service.getOrders({ status: 'processing' });

      expect(mockApiInstance.get).toHaveBeenCalledWith('orders', { status: 'processing' });
      expect(result).toEqual({
        success: true,
        data: mockOrders,
        headers: mockHeaders,
      });
    });

    it('should handle errors when fetching orders', async () => {
      const mockError = new Error('Fetch failed');
      mockError.response = { data: { message: 'Invalid parameters' } };
      mockApiInstance.get.mockRejectedValue(mockError);

      const result = await service.getOrders();

      expect(result).toEqual({ success: false, error: 'Invalid parameters' });
    });
  });

  describe('getAllOrders', () => {
    it('should fetch all orders across multiple pages', async () => {
      const page1Orders = [{ id: 1 }, { id: 2 }];
      const page2Orders = [{ id: 3 }, { id: 4 }];

      mockApiInstance.get
        .mockResolvedValueOnce({
          data: page1Orders,
          headers: { 'x-wp-totalpages': '2', 'x-wp-total': '4' },
        })
        .mockResolvedValueOnce({
          data: page2Orders,
          headers: { 'x-wp-totalpages': '2', 'x-wp-total': '4' },
        });

      const result = await service.getAllOrders({ per_page: 2 });

      expect(mockApiInstance.get).toHaveBeenCalledTimes(2);
      expect(result.success).toBe(true);
      expect(result.data).toEqual([...page1Orders, ...page2Orders]);
      expect(result.totalPages).toBe(2);
    });

    it('should call onBatchLoaded callback for each batch', async () => {
      const mockCallback = vi.fn();
      const page1Orders = [{ id: 1 }];

      mockApiInstance.get.mockResolvedValue({
        data: page1Orders,
        headers: { 'x-wp-totalpages': '1', 'x-wp-total': '1' },
      });

      await service.getAllOrders({}, mockCallback);

      expect(mockCallback).toHaveBeenCalledWith({
        currentPage: 1,
        totalPages: 1,
        totalItems: 1,
        batchData: page1Orders,
        allData: page1Orders,
        progress: 100,
      });
    });

    it('should handle cancellation', async () => {
      const cancelCheck = vi.fn().mockReturnValue(true);

      const result = await service.getAllOrders({}, null, { cancelCheck });

      expect(result).toEqual({
        success: false,
        error: 'Loading cancelled',
        cancelled: true,
      });
      expect(mockApiInstance.get).not.toHaveBeenCalled();
    });
  });

  describe('getOrder', () => {
    it('should fetch a single order by ID', async () => {
      const mockOrder = { id: 123, status: 'completed' };
      mockApiInstance.get.mockResolvedValue({ data: mockOrder });

      const result = await service.getOrder(123);

      expect(mockApiInstance.get).toHaveBeenCalledWith('orders/123');
      expect(result).toEqual({ success: true, data: mockOrder });
    });
  });

  describe('updateOrder', () => {
    it('should update an order', async () => {
      const updatedOrder = { id: 123, status: 'completed' };
      mockApiInstance.put.mockResolvedValue({ data: updatedOrder });

      const result = await service.updateOrder(123, { status: 'completed' });

      expect(mockApiInstance.put).toHaveBeenCalledWith('orders/123', { status: 'completed' });
      expect(result).toEqual({ success: true, data: updatedOrder });
    });
  });

  describe('deleteOrder', () => {
    it('should delete an order', async () => {
      const deletedOrder = { id: 123, deleted: true };
      mockApiInstance.delete.mockResolvedValue({ data: deletedOrder });

      const result = await service.deleteOrder(123);

      expect(mockApiInstance.delete).toHaveBeenCalledWith('orders/123', { force: true });
      expect(result).toEqual({ success: true, data: deletedOrder });
    });
  });

  describe('getProducts', () => {
    it('should fetch products successfully', async () => {
      const mockProducts = [{ id: 1, name: 'Product 1' }];
      const mockHeaders = { 'x-wp-total': '1' };
      mockApiInstance.get.mockResolvedValue({
        data: mockProducts,
        headers: mockHeaders,
      });

      const result = await service.getProducts({ per_page: 10 });

      expect(mockApiInstance.get).toHaveBeenCalledWith('products', { per_page: 10 });
      expect(result).toEqual({
        success: true,
        data: mockProducts,
        headers: mockHeaders,
      });
    });
  });

  describe('updateProduct', () => {
    it('should update a product', async () => {
      const updatedProduct = { id: 1, name: 'Updated Product' };
      mockApiInstance.put.mockResolvedValue({ data: updatedProduct });

      const result = await service.updateProduct(1, { name: 'Updated Product' });

      expect(mockApiInstance.put).toHaveBeenCalledWith('products/1', { name: 'Updated Product' });
      expect(result).toEqual({ success: true, data: updatedProduct });
    });
  });

  describe('batchUpdateProducts', () => {
    it('should batch update products', async () => {
      const mockResponse = { update: [{ id: 1 }, { id: 2 }] };
      mockApiInstance.post.mockResolvedValue({ data: mockResponse });

      const updates = [{ id: 1, price: '10' }, { id: 2, price: '20' }];
      const result = await service.batchUpdateProducts(updates);

      expect(mockApiInstance.post).toHaveBeenCalledWith('products/batch', { update: updates });
      expect(result).toEqual({ success: true, data: mockResponse });
    });
  });

  describe('updateStock', () => {
    it('should update product stock', async () => {
      const updatedProduct = { id: 1, stock_quantity: 50, stock_status: 'instock' };
      mockApiInstance.put.mockResolvedValue({ data: updatedProduct });

      const result = await service.updateStock(1, 50, 'instock');

      expect(mockApiInstance.put).toHaveBeenCalledWith('products/1', {
        stock_quantity: 50,
        stock_status: 'instock',
        manage_stock: true,
      });
      expect(result).toEqual({ success: true, data: updatedProduct });
    });
  });
});
