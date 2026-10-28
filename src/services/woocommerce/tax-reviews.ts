import type {
  WooCommerceTaxRate,
  TaxRateUpdateData,
  WooCommerceTaxClass,
  TaxClassCreateData,
  WooCommerceReview,
  ReviewUpdateData,
  ReviewQueryParams,
  BatchOperationResponse,
  ApiResponse,
  PaginatedApiResponse,
  OnBatchLoaded,
} from '../../types';
import { type WooCommerceApiResponse, type PaginatedFetchOptions } from './base';
import { WooCommerceServiceCoupons } from './coupons';

export class WooCommerceServiceTaxReviews extends WooCommerceServiceCoupons {
  // ============================================
  // Tax Rates & Classes
  // ============================================

  async getTaxRates(
    params: { page?: number; per_page?: number; class?: string } = {}
  ): Promise<ApiResponse<WooCommerceTaxRate[]>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceTaxRate[]> =
        await (await this.getApi()).get('taxes', { per_page: 100, ...params });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async createTaxRate(data: TaxRateUpdateData): Promise<ApiResponse<WooCommerceTaxRate>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceTaxRate> =
        await (await this.getApi()).post('taxes', data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async updateTaxRate(id: number, data: TaxRateUpdateData): Promise<ApiResponse<WooCommerceTaxRate>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceTaxRate> =
        await (await this.getApi()).put(`taxes/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async deleteTaxRate(id: number): Promise<ApiResponse<WooCommerceTaxRate>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceTaxRate> =
        await (await this.getApi()).delete(`taxes/${id}`, { force: true });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async getTaxClasses(): Promise<ApiResponse<WooCommerceTaxClass[]>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceTaxClass[]> =
        await (await this.getApi()).get('taxes/classes');
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async createTaxClass(data: TaxClassCreateData): Promise<ApiResponse<WooCommerceTaxClass>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceTaxClass> =
        await (await this.getApi()).post('taxes/classes', data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async deleteTaxClass(slug: string): Promise<ApiResponse<WooCommerceTaxClass>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceTaxClass> =
        await (await this.getApi()).delete(`taxes/classes/${slug}`, { force: true });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  // ============================================
  // Product Reviews
  // ============================================

  async getReviews(
    params: ReviewQueryParams = {}
  ): Promise<ApiResponse<WooCommerceReview[]> & { headers?: Record<string, string> }> {
    try {
      const response: WooCommerceApiResponse<WooCommerceReview[]> =
        await (await this.getApi()).get('products/reviews', { per_page: 50, ...params });
      return { success: true, data: response.data, headers: response.headers };
    } catch (error) {
      return this.fail(error);
    }
  }

  async getAllReviews(
    params: ReviewQueryParams = {},
    onBatchLoaded: OnBatchLoaded<WooCommerceReview> | null = null,
    options: PaginatedFetchOptions = {}
  ): Promise<PaginatedApiResponse<WooCommerceReview>> {
    return this.paginatedFetch<WooCommerceReview, ReviewQueryParams>(
      'products/reviews',
      { ...params, orderby: 'date', order: 'desc' },
      onBatchLoaded,
      options
    );
  }

  async getReview(id: number): Promise<ApiResponse<WooCommerceReview>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceReview> =
        await (await this.getApi()).get(`products/reviews/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async updateReview(id: number, data: ReviewUpdateData): Promise<ApiResponse<WooCommerceReview>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceReview> =
        await (await this.getApi()).put(`products/reviews/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async deleteReview(id: number): Promise<ApiResponse<WooCommerceReview>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceReview> =
        await (await this.getApi()).delete(`products/reviews/${id}`, { force: true });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async batchUpdateReviews(
    updates: Array<{ id: number } & ReviewUpdateData>
  ): Promise<ApiResponse<BatchOperationResponse<WooCommerceReview>>> {
    try {
      const response: WooCommerceApiResponse<BatchOperationResponse<WooCommerceReview>> =
        await (await this.getApi()).post('products/reviews/batch', { update: updates });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }
}
