import { vi } from 'vitest';
import WooCommerceService from '../woocommerce';
import { createMockStore } from '../../__test_utils__';

const { mockGet, mockPost, MockApiConstructor } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  MockApiConstructor: vi.fn(),
}));

vi.mock('@woocommerce/woocommerce-rest-api', () => ({
  __esModule: true,
  default: MockApiConstructor,
}));

vi.mock('../../utils/urlPatterns', () => ({
  normalizeStoreUrl: (url: string) => url,
}));

describe('WooCommerceService extensions', () => {
  let service: WooCommerceService;

  beforeEach(() => {
    MockApiConstructor.mockImplementation(function () {
      return { get: mockGet, post: mockPost, put: vi.fn(), delete: vi.fn() };
    });
    service = new WooCommerceService(createMockStore());
  });

  describe('error mapping', () => {
    it.each([401, 403])('maps HTTP %i to invalid_credentials', async (status) => {
      mockGet.mockRejectedValue({ response: { status, data: { message: 'nope' } } });
      const result = await service.getOrder(1);
      expect(result).toEqual({
        success: false,
        error: 'Invalid credentials',
        code: 'invalid_credentials',
      });
    });

    it('maps timeouts', async () => {
      mockGet.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 30000ms exceeded' });
      const result = await service.getOrder(1);
      expect(!result.success && result.code).toBe('timeout');
    });

    it('maps network errors to offline', async () => {
      mockGet.mockRejectedValue({ code: 'ERR_NETWORK', message: 'Network Error' });
      const result = await service.getOrder(1);
      expect(!result.success && result.code).toBe('offline');
    });

    it('keeps server message for other errors', async () => {
      mockGet.mockRejectedValue({ response: { status: 500, data: { message: 'boom' } } });
      const result = await service.getOrder(1);
      expect(result).toEqual({ success: false, error: 'boom' });
    });
  });

  describe('pagination', () => {
    it('returns totalItems from X-WP-Total', async () => {
      mockGet.mockResolvedValue({
        data: [{ id: 1 }],
        headers: { 'x-wp-totalpages': '1', 'x-wp-total': '42' },
      });
      const result = await service.getAllOrders({ _fields: 'id' });
      expect(result).toMatchObject({ success: true, totalPages: 1, totalItems: 42 });
      expect(mockGet).toHaveBeenCalledWith('orders', expect.objectContaining({ _fields: 'id' }));
    });
  });

  describe('getOrdersSince', () => {
    it('sends modified_after', async () => {
      mockGet.mockResolvedValue({ data: [], headers: { 'x-wp-totalpages': '1' } });
      await service.getOrdersSince('2026-01-01T00:00:00');
      expect(mockGet).toHaveBeenCalledWith(
        'orders',
        expect.objectContaining({ modified_after: '2026-01-01T00:00:00' })
      );
    });
  });

  describe('batch endpoints', () => {
    it('chunks ops by 100 and merges results', async () => {
      mockPost.mockImplementation(async (_e: string, body: { delete?: number[] }) => ({
        data: { delete: (body.delete ?? []).map((id) => ({ id })) },
      }));
      const ids = Array.from({ length: 250 }, (_, i) => i + 1);
      const result = await service.batchCoupons({ delete: ids });
      expect(mockPost).toHaveBeenCalledTimes(3);
      expect(mockPost.mock.calls[0]?.[0]).toBe('coupons/batch');
      if (!result.success) throw new Error('Expected success');
      expect(result.data.delete).toHaveLength(250);
    });

    it.each([
      ['batchOrders', 'orders/batch'],
      ['batchCustomers', 'customers/batch'],
      ['batchProducts', 'products/batch'],
    ] as const)('%s posts to %s', async (method, endpoint) => {
      mockPost.mockResolvedValue({ data: { create: [] } });
      await service[method]({ create: [{}] } as never);
      expect(mockPost).toHaveBeenCalledWith(endpoint, expect.objectContaining({ create: [{}] }));
    });

    it('returns mapped error on failure', async () => {
      mockPost.mockRejectedValue({ response: { status: 401 } });
      const result = await service.batchOrders({ delete: [1] });
      expect(!result.success && result.code).toBe('invalid_credentials');
    });
  });

  describe('admin endpoints', () => {
    it.each([
      ['getSalesReport', 'reports/sales'],
      ['getTopSellersReport', 'reports/top_sellers'],
      ['getPaymentGateways', 'payment_gateways'],
      ['getShippingZones', 'shipping/zones'],
      ['getWebhooks', 'webhooks'],
      ['getSettingGroups', 'settings'],
    ] as const)('%s hits %s', async (method, endpoint) => {
      mockGet.mockResolvedValue({ data: [{ id: 1 }], headers: {} });
      const result = await service[method]();
      expect(mockGet.mock.calls[0]?.[0]).toBe(endpoint);
      expect(result.success).toBe(true);
    });
  });
});
