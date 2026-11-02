import type { ApiResponse } from '../../types';
import { type WooCommerceApiResponse } from './base';
import { WooCommerceServiceTaxReviews } from './tax-reviews';

// Loose shapes: these endpoints are consumed read-only by health/analytics views.
export interface WooCommerceSalesReport {
  total_sales: string;
  net_sales: string;
  average_sales: string;
  total_orders: number;
  total_items: number;
  total_tax: string;
  total_shipping: string;
  total_refunds: number;
  total_discount: string;
  totals_grouped_by: string;
  totals: Record<string, Record<string, unknown>>;
}
export interface WooCommerceTopSeller {
  title: string;
  product_id: number;
  quantity: number;
}
export interface WooCommercePaymentGateway {
  id: string;
  title: string;
  enabled: boolean;
  method_title: string;
}
export interface WooCommerceShippingZone {
  id: number;
  name: string;
  order: number;
}
export interface WooCommerceWebhook {
  id: number;
  name: string;
  status: string;
  topic: string;
  delivery_url: string;
}
export interface WooCommerceSettingGroup {
  id: string;
  label: string;
  description: string;
}

interface ReportParams {
  period?: string;
  date_min?: string;
  date_max?: string;
}

export class WooCommerceServiceAdmin extends WooCommerceServiceTaxReviews {
  private async getResource<T>(endpoint: string, params?: object): Promise<ApiResponse<T>> {
    try {
      const response: WooCommerceApiResponse<T> = await (await this.getApi()).get(endpoint, params);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  getSalesReport(params: ReportParams = {}) {
    return this.getResource<WooCommerceSalesReport[]>('reports/sales', params);
  }

  getTopSellersReport(params: ReportParams = {}) {
    return this.getResource<WooCommerceTopSeller[]>('reports/top_sellers', params);
  }

  getPaymentGateways() {
    return this.getResource<WooCommercePaymentGateway[]>('payment_gateways');
  }

  getShippingZones() {
    return this.getResource<WooCommerceShippingZone[]>('shipping/zones');
  }

  getWebhooks(params: { status?: string; per_page?: number } = {}) {
    return this.getResource<WooCommerceWebhook[]>('webhooks', params);
  }

  private async writeResource<T>(
    method: 'post' | 'put' | 'delete',
    endpoint: string,
    data?: object
  ): Promise<ApiResponse<T>> {
    try {
      const api = await this.getApi();
      const response: WooCommerceApiResponse<T> =
        method === 'delete' ? await api.delete(endpoint, data) : await api[method](endpoint, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  /** `secret` is sent to WooCommerce only; it is never returned to or retained by the UI. */
  createWebhook(input: { name: string; topic: string; delivery_url: string; secret?: string }) {
    return this.writeResource<WooCommerceWebhook>('post', 'webhooks', {
      ...input,
      status: 'active',
    });
  }

  setWebhookStatus(id: number, status: 'active' | 'paused' | 'disabled') {
    return this.writeResource<WooCommerceWebhook>('put', `webhooks/${id}`, { status });
  }

  deleteWebhook(id: number) {
    return this.writeResource<WooCommerceWebhook>('delete', `webhooks/${id}`, { force: true });
  }

  setPaymentGatewayEnabled(id: string, enabled: boolean) {
    return this.writeResource<WooCommercePaymentGateway>(
      'put',
      `payment_gateways/${encodeURIComponent(id)}`,
      { enabled }
    );
  }

  getSettingGroups() {
    return this.getResource<WooCommerceSettingGroup[]>('settings');
  }
}
