import type {
  WooCommerceStore,
  SystemStatus,
  ApiResponse,
  PaginatedApiResponse,
  BatchLoadProgress,
  OnBatchLoaded,
} from '../../types';
import { normalizeStoreUrl } from '../../utils/urlPatterns';

// ============================================
// Internal Types
// ============================================

export interface WooCommerceApiResponse<T> {
  data: T;
  headers: Record<string, string>;
}

export interface PaginatedFetchOptions {
  batchDelay?: number;
  cancelCheck?: () => boolean;
}

export interface WooCommerceApiError {
  response?: {
    data?: {
      message?: string;
      code?: string;
    };
  };
  message?: string;
}

export interface WooCommerceRestApiInstance {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get: (endpoint: string, params?: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  post: (endpoint: string, data?: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  put: (endpoint: string, data?: any) => Promise<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  delete: (endpoint: string, params?: any) => Promise<any>;
}

// ============================================
// Lazy API Loader
// ============================================

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let WooCommerceRestApiClass: (new (options: any) => WooCommerceRestApiInstance) | null = null;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadWooCommerceAPI(): Promise<new (options: any) => WooCommerceRestApiInstance> {
  if (!WooCommerceRestApiClass) {
    const module = await import('@woocommerce/woocommerce-rest-api');
    WooCommerceRestApiClass = module.default;
  }
  return WooCommerceRestApiClass!;
}

// ============================================
// Base Class
// ============================================

/**
 * Base WooCommerce service with constructor, lazy API init, and shared helpers.
 * Extended by resource-specific classes — do not instantiate directly.
 */
export class WooCommerceServiceBase {
  protected api: WooCommerceRestApiInstance | null = null;
  protected readonly storeConfig: WooCommerceStore;
  protected readonly BATCH_SIZE = 100;

  constructor(storeConfig: WooCommerceStore) {
    if (!storeConfig) throw new Error('Store configuration is required');
    this.storeConfig = storeConfig;
  }

  protected async getApi(): Promise<WooCommerceRestApiInstance> {
    if (!this.api) {
      const ApiConstructor = await loadWooCommerceAPI();
      const normalizedUrl = normalizeStoreUrl(this.storeConfig.url) || this.storeConfig.url;
      this.api = new ApiConstructor({
        url: normalizedUrl,
        consumerKey: this.storeConfig.consumerKey,
        consumerSecret: this.storeConfig.consumerSecret,
        version: 'wc/v3',
        queryStringAuth: true,
      });
    }
    return this.api;
  }

  protected getErrorMessage(error: WooCommerceApiError): string {
    return error.response?.data?.message || error.message || 'Unknown error';
  }

  protected async paginatedFetch<T, P extends object = Record<string, unknown>>(
    endpoint: string,
    params: P = {} as P,
    onBatchLoaded: OnBatchLoaded<T> | null = null,
    options: PaginatedFetchOptions = {}
  ): Promise<PaginatedApiResponse<T>> {
    try {
      const api = await this.getApi();
      const paramsObj = params as Record<string, unknown>;
      const perPage = (paramsObj.per_page as number) || 25;
      const baseParams = { ...params, per_page: perPage };
      const { batchDelay = 0, cancelCheck = null } = options;

      let allItems: T[] = [];
      let page = 1;
      let totalPages = 1;

      do {
        if (cancelCheck && cancelCheck()) {
          return { success: false, error: 'Loading cancelled', cancelled: true };
        }

        const response: WooCommerceApiResponse<T[]> = await api.get(endpoint, { ...baseParams, page });

        if (!response.data) return { success: false, error: 'No data received' };

        allItems = [...allItems, ...response.data];

        const headers = response.headers || {};
        totalPages = parseInt(headers['x-wp-totalpages'] || '1', 10);
        const totalItems = parseInt(headers['x-wp-total'] || String(allItems.length), 10);

        if (onBatchLoaded) {
          const progress: BatchLoadProgress<T> = {
            currentPage: page,
            totalPages,
            totalItems,
            batchData: response.data,
            allData: allItems,
            progress: Math.round((page / totalPages) * 100),
          };
          onBatchLoaded(progress);
        }

        page++;

        if (batchDelay > 0 && page <= totalPages) {
          await new Promise((resolve) => setTimeout(resolve, batchDelay));
        }
      } while (page <= totalPages);

      return { success: true, data: allItems, totalPages };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }

  // ============================================
  // Connection
  // ============================================

  async testConnection(): Promise<ApiResponse<SystemStatus>> {
    try {
      const response: WooCommerceApiResponse<SystemStatus> =
        await (await this.getApi()).get('system_status');
      return { success: true, data: response.data };
    } catch (error) {
      return { success: false, error: this.getErrorMessage(error as WooCommerceApiError) };
    }
  }
}
