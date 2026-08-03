import type {
  WooCommerceCustomer,
  WooCommerceOrder,
  CustomerQueryParams,
  OrderQueryParams,
  ApiResponse,
  PaginatedApiResponse,
  OnBatchLoaded,
} from '../../types';
import { type WooCommerceApiResponse, type WooCommerceApiError, type PaginatedFetchOptions } from './base';
import { WooCommerceServiceProducts } from './products';

export class WooCommerceServiceCustomers extends WooCommerceServiceProducts {
  // ============================================
  // Customers
  // ============================================

  async getCustomers(
    params: CustomerQueryParams = {}
  ): Promise<ApiResponse<WooCommerceCustomer[]> & { headers?: Record<string, string> }> {
    try {
      const response: WooCommerceApiResponse<WooCommerceCustomer[]> =
        await (await this.getApi()).get('customers', params);
      return { success: true, data: response.data, headers: response.headers };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async getAllCustomers(
    params: CustomerQueryParams = {},
    onBatchLoaded: OnBatchLoaded<WooCommerceCustomer> | null = null,
    options: PaginatedFetchOptions = {}
  ): Promise<PaginatedApiResponse<WooCommerceCustomer>> {
    return this.paginatedFetch<WooCommerceCustomer, CustomerQueryParams>(
      'customers',
      { ...params, orderby: 'registered_date', order: 'desc' },
      onBatchLoaded,
      options
    );
  }

  async getCustomer(id: number): Promise<ApiResponse<WooCommerceCustomer>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceCustomer> =
        await (await this.getApi()).get(`customers/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async updateCustomer(
    id: number,
    data: Partial<WooCommerceCustomer>
  ): Promise<ApiResponse<WooCommerceCustomer>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceCustomer> =
        await (await this.getApi()).put(`customers/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async getCustomerOrders(
    customerId: number,
    params: OrderQueryParams = {}
  ): Promise<ApiResponse<WooCommerceOrder[]>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceOrder[]> =
        await (await this.getApi()).get('orders', { ...params, customer: customerId });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }
}
