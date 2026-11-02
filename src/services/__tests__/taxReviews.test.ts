import { vi } from 'vitest';
import WooCommerceService from '../woocommerce';
import { createMockStore } from '../../__test_utils__';

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

const boom = { response: { status: 500, data: { message: 'boom' } } };
const failure = { success: false, error: 'boom' };

describe('WooCommerceService tax & reviews', () => {
  let service: WooCommerceService;

  beforeEach(() => {
    MockApiConstructor.mockImplementation(function () {
      return { get: mockGet, post: mockPost, put: mockPut, delete: mockDelete };
    });
    service = new WooCommerceService(createMockStore());
  });

  describe('tax rates', () => {
    it('getTaxRates uses default per_page and merges params', async () => {
      mockGet.mockResolvedValue({ data: [{ id: 1 }] });
      expect(await service.getTaxRates()).toEqual({ success: true, data: [{ id: 1 }] });
      expect(mockGet).toHaveBeenCalledWith('taxes', { per_page: 100 });
      await service.getTaxRates({ class: 'reduced', per_page: 10 });
      expect(mockGet).toHaveBeenLastCalledWith('taxes', { per_page: 10, class: 'reduced' });
    });

    it('createTaxRate posts data', async () => {
      mockPost.mockResolvedValue({ data: { id: 2 } });
      expect(await service.createTaxRate({ rate: '20' })).toEqual({
        success: true,
        data: { id: 2 },
      });
      expect(mockPost).toHaveBeenCalledWith('taxes', { rate: '20' });
    });

    it('updateTaxRate puts to id', async () => {
      mockPut.mockResolvedValue({ data: { id: 3 } });
      expect((await service.updateTaxRate(3, { rate: '5' })).success).toBe(true);
      expect(mockPut).toHaveBeenCalledWith('taxes/3', { rate: '5' });
    });

    it('deleteTaxRate forces delete', async () => {
      mockDelete.mockResolvedValue({ data: { id: 3 } });
      expect((await service.deleteTaxRate(3)).success).toBe(true);
      expect(mockDelete).toHaveBeenCalledWith('taxes/3', { force: true });
    });

    it('maps errors on all rate methods', async () => {
      mockGet.mockRejectedValue(boom);
      mockPost.mockRejectedValue(boom);
      mockPut.mockRejectedValue(boom);
      mockDelete.mockRejectedValue(boom);
      expect(await service.getTaxRates()).toEqual(failure);
      expect(await service.createTaxRate({})).toEqual(failure);
      expect(await service.updateTaxRate(1, {})).toEqual(failure);
      expect(await service.deleteTaxRate(1)).toEqual(failure);
    });
  });

  describe('tax classes', () => {
    it('get/create/delete success', async () => {
      mockGet.mockResolvedValue({ data: [{ slug: 'standard' }] });
      mockPost.mockResolvedValue({ data: { slug: 'reduced' } });
      mockDelete.mockResolvedValue({ data: { slug: 'reduced' } });
      expect(await service.getTaxClasses()).toEqual({
        success: true,
        data: [{ slug: 'standard' }],
      });
      expect((await service.createTaxClass({ name: 'Reduced' })).success).toBe(true);
      expect((await service.deleteTaxClass('reduced')).success).toBe(true);
      expect(mockGet).toHaveBeenCalledWith('taxes/classes');
      expect(mockPost).toHaveBeenCalledWith('taxes/classes', { name: 'Reduced' });
      expect(mockDelete).toHaveBeenCalledWith('taxes/classes/reduced', { force: true });
    });

    it('maps errors', async () => {
      mockGet.mockRejectedValue(boom);
      mockPost.mockRejectedValue(boom);
      mockDelete.mockRejectedValue(boom);
      expect(await service.getTaxClasses()).toEqual(failure);
      expect(await service.createTaxClass({ name: 'x' })).toEqual(failure);
      expect(await service.deleteTaxClass('x')).toEqual(failure);
    });

    it('maps credential errors', async () => {
      mockGet.mockRejectedValue({ response: { status: 401 } });
      expect(await service.getTaxClasses()).toMatchObject({ code: 'invalid_credentials' });
    });
  });

  describe('reviews', () => {
    it('getReviews returns headers and merges params', async () => {
      mockGet.mockResolvedValue({ data: [], headers: { 'x-wp-total': '0' } });
      const r = await service.getReviews({ status: 'hold' });
      expect(r).toEqual({ success: true, data: [], headers: { 'x-wp-total': '0' } });
      expect(mockGet).toHaveBeenCalledWith('products/reviews', { per_page: 50, status: 'hold' });
    });

    it('getAllReviews paginates newest first and reports batches', async () => {
      mockGet.mockResolvedValue({ data: [{ id: 1 }], headers: { 'x-wp-totalpages': '1' } });
      const onBatch = vi.fn();
      const r = await service.getAllReviews({}, onBatch);
      expect(r.success).toBe(true);
      expect(mockGet).toHaveBeenCalledWith(
        'products/reviews',
        expect.objectContaining({ orderby: 'date', order: 'desc' })
      );
      expect(onBatch).toHaveBeenCalled();
    });

    it('getAllReviews maps errors', async () => {
      mockGet.mockRejectedValue(boom);
      expect(await service.getAllReviews()).toMatchObject(failure);
    });

    it('get/update/delete/batch errors', async () => {
      mockGet.mockRejectedValue(boom);
      mockPut.mockRejectedValue(boom);
      mockDelete.mockRejectedValue(boom);
      mockPost.mockRejectedValue(boom);
      expect(await service.getReviews()).toEqual(failure);
      expect(await service.getReview(1)).toEqual(failure);
      expect(await service.updateReview(1, {})).toEqual(failure);
      expect(await service.deleteReview(1)).toEqual(failure);
      expect(await service.batchUpdateReviews([{ id: 1, status: 'approved' }])).toEqual(failure);
    });

    it('delete forces and batch posts update list', async () => {
      mockDelete.mockResolvedValue({ data: { id: 1 } });
      mockPost.mockResolvedValue({ data: { update: [] } });
      await service.deleteReview(1);
      expect(mockDelete).toHaveBeenCalledWith('products/reviews/1', { force: true });
      await service.batchUpdateReviews([{ id: 1, status: 'spam' }]);
      expect(mockPost).toHaveBeenCalledWith('products/reviews/batch', {
        update: [{ id: 1, status: 'spam' }],
      });
    });
  });
});
