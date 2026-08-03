import type {
  WooCommerceOrder,
  OrderQueryParams,
  OrderUpdateData,
  OrderNote,
  ApiResponse,
  PaginatedApiResponse,
  OnBatchLoaded,
  BatchOperationResponse,
} from '../../types';
import {
  WooCommerceServiceBase,
  type WooCommerceApiResponse,
  type WooCommerceApiError,
  type PaginatedFetchOptions,
} from './base';

export class WooCommerceServiceOrders extends WooCommerceServiceBase {
  // ============================================
  // Orders
  // ============================================

  async getOrders(
    params: OrderQueryParams = {}
  ): Promise<ApiResponse<WooCommerceOrder[]> & { headers?: Record<string, string> }> {
    try {
      const response: WooCommerceApiResponse<WooCommerceOrder[]> =
        await (await this.getApi()).get('orders', params);
      return { success: true, data: response.data, headers: response.headers };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async getAllOrders(
    params: OrderQueryParams = {},
    onBatchLoaded: OnBatchLoaded<WooCommerceOrder> | null = null,
    options: PaginatedFetchOptions = {}
  ): Promise<PaginatedApiResponse<WooCommerceOrder>> {
    return this.paginatedFetch<WooCommerceOrder, OrderQueryParams>(
      'orders',
      { ...params, orderby: 'date', order: 'desc' },
      onBatchLoaded,
      options
    );
  }

  async getOrder(id: number): Promise<ApiResponse<WooCommerceOrder>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceOrder> =
        await (await this.getApi()).get(`orders/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async updateOrder(id: number, data: OrderUpdateData): Promise<ApiResponse<WooCommerceOrder>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceOrder> =
        await (await this.getApi()).put(`orders/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async deleteOrder(id: number): Promise<ApiResponse<WooCommerceOrder>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceOrder> =
        await (await this.getApi()).delete(`orders/${id}`, { force: true });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async createOrder(data: Record<string, unknown>): Promise<ApiResponse<WooCommerceOrder>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceOrder> =
        await (await this.getApi()).post('orders', data);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async refundOrder(
    orderId: number,
    amount?: number,
    reason?: string
  ): Promise<ApiResponse<{ id: number; amount: string; reason: string }>> {
    try {
      const refundData: Record<string, unknown> = { reason: reason || 'POS Refund' };
      if (amount !== undefined) refundData.amount = amount.toString();
      const response: WooCommerceApiResponse<{ id: number; amount: string; reason: string }> =
        await (await this.getApi()).post(`orders/${orderId}/refunds`, refundData);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async batchUpdateOrders(
    updates: Array<{ id: number } & OrderUpdateData>
  ): Promise<ApiResponse<BatchOperationResponse<WooCommerceOrder>>> {
    try {
      const response: WooCommerceApiResponse<BatchOperationResponse<WooCommerceOrder>> =
        await (await this.getApi()).post('orders/batch', { update: updates });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async getOrdersMinimal(
    params: OrderQueryParams = {}
  ): Promise<ApiResponse<Partial<WooCommerceOrder>[]>> {
    try {
      const response: WooCommerceApiResponse<Partial<WooCommerceOrder>[]> =
        await (await this.getApi()).get('orders', {
          ...params,
          _fields: 'id,status,total,billing,date_created,line_items,currency',
        });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  // ============================================
  // Order Notes
  // ============================================

  async getOrderNotes(orderId: number): Promise<ApiResponse<OrderNote[]>> {
    try {
      const response: WooCommerceApiResponse<OrderNote[]> =
        await (await this.getApi()).get(`orders/${orderId}/notes`);
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async addOrderNote(
    orderId: number,
    note: string,
    customerNote: boolean = false
  ): Promise<ApiResponse<OrderNote>> {
    try {
      const response: WooCommerceApiResponse<OrderNote> =
        await (await this.getApi()).post(`orders/${orderId}/notes`, {
          note,
          customer_note: customerNote,
        });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  async deleteOrderNote(orderId: number, noteId: number): Promise<ApiResponse<{ id: number }>> {
    try {
      const response: WooCommerceApiResponse<{ id: number }> =
        await (await this.getApi()).delete(`orders/${orderId}/notes/${noteId}`, { force: true });
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }
}
