import type {
  WooCommerceCoupon,
  CouponQueryParams,
  CouponUpdateData,
  BatchOperationResponse,
  ApiResponse,
  PaginatedApiResponse,
  OnBatchLoaded,
} from '../../types';
import { type WooCommerceApiResponse, type PaginatedFetchOptions } from './base';
import { WooCommerceServiceCustomers } from './customers';

export class WooCommerceServiceCoupons extends WooCommerceServiceCustomers {
  // ============================================
  // Coupons
  // ============================================

  async getCoupons(
    params: CouponQueryParams = {}
  ): Promise<ApiResponse<WooCommerceCoupon[]> & { headers?: Record<string, string> }> {
    try {
      const response: WooCommerceApiResponse<WooCommerceCoupon[]> =
        await (await this.getApi()).get('coupons', params);
      return { success: true, data: response.data, headers: response.headers };
    } catch (error) {
      return this.fail(error);
    }
  }

  async getAllCoupons(
    params: CouponQueryParams = {},
    onBatchLoaded: OnBatchLoaded<WooCommerceCoupon> | null = null,
    options: PaginatedFetchOptions = {}
  ): Promise<PaginatedApiResponse<WooCommerceCoupon>> {
    return this.paginatedFetch<WooCommerceCoupon, CouponQueryParams>(
      'coupons',
      { ...params, orderby: 'date', order: 'desc' },
      onBatchLoaded,
      options
    );
  }

  async getCoupon(id: number): Promise<ApiResponse<WooCommerceCoupon>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceCoupon> =
        await (await this.getApi()).get(`coupons/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async createCoupon(data: CouponUpdateData): Promise<ApiResponse<WooCommerceCoupon>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceCoupon> =
        await (await this.getApi()).post('coupons', data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async updateCoupon(id: number, data: CouponUpdateData): Promise<ApiResponse<WooCommerceCoupon>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceCoupon> =
        await (await this.getApi()).put(`coupons/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async deleteCoupon(id: number): Promise<ApiResponse<WooCommerceCoupon>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceCoupon> =
        await (await this.getApi()).delete(`coupons/${id}`, { force: true });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async batchUpdateCoupons(
    updates: Array<{ id: number } & CouponUpdateData>
  ): Promise<ApiResponse<BatchOperationResponse<WooCommerceCoupon>>> {
    try {
      const response: WooCommerceApiResponse<BatchOperationResponse<WooCommerceCoupon>> =
        await (await this.getApi()).post('coupons/batch', { update: updates });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async batchCreateCoupons(
    coupons: CouponUpdateData[]
  ): Promise<ApiResponse<BatchOperationResponse<WooCommerceCoupon>>> {
    try {
      const response: WooCommerceApiResponse<BatchOperationResponse<WooCommerceCoupon>> =
        await (await this.getApi()).post('coupons/batch', { create: coupons });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async batchCoupons(ops: {
    create?: CouponUpdateData[];
    update?: Array<{ id: number } & CouponUpdateData>;
    delete?: number[];
  }): Promise<ApiResponse<BatchOperationResponse<WooCommerceCoupon>>> {
    return this.batchResource<WooCommerceCoupon>('coupons', ops);
  }
}
