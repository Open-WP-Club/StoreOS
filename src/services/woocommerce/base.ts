import type {
  WooCommerceStore,
  SystemStatus,
  ApiResponse,
  ApiErrorResponse,
  BatchOperationResponse,
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
  code?: string;
  response?: {
    status?: number;
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
        timeout: 30000,
      });
    }
    return this.api;
  }

  protected getErrorMessage(error: WooCommerceApiError): string {
    return error.response?.data?.message || error.message || 'Unknown error';
  }

  /** Map any thrown API error to an ApiErrorResponse with a typed `code` the UI can branch on. */
  protected fail(error: unknown): ApiErrorResponse {
    const e = error as WooCommerceApiError;
    const status = e?.response?.status;
    if (status === 401 || status === 403) {
      return { success: false, error: 'Invalid credentials', code: 'invalid_credentials' };
    }
    if (e?.code === 'ECONNABORTED' || e?.code === 'ETIMEDOUT') {
      return { success: false, error: 'Request timed out', code: 'timeout' };
    }
    if (!e?.response && (e?.code === 'ERR_NETWORK' || e?.message === 'Network Error')) {
      return { success: false, error: 'Network error - check your connection', code: 'offline' };
    }
    return { success: false, error: this.getErrorMessage(e) };
  }

  /** POST `<resource>/batch`, chunking create/update/delete into groups of BATCH_SIZE (API max 100). */
  protected async batchResource<T>(
    resource: string,
    ops: { create?: unknown[]; update?: unknown[]; delete?: number[] }
  ): Promise<ApiResponse<BatchOperationResponse<T>>> {
    try {
      const api = await this.getApi();
      const out: BatchOperationResponse<T> = {};
      const n = this.BATCH_SIZE;
      const len = Math.max(ops.create?.length ?? 0, ops.update?.length ?? 0, ops.delete?.length ?? 0);
      for (let i = 0; i < len; i += n) {
        const body = {
          create: ops.create?.slice(i, i + n),
          update: ops.update?.slice(i, i + n),
          delete: ops.delete?.slice(i, i + n),
        };
        const res: WooCommerceApiResponse<BatchOperationResponse<T>> = await api.post(
          `${resource}/batch`,
          body
        );
        for (const k of ['create', 'update', 'delete'] as const) {
          if (res.data[k]) out[k] = [...(out[k] ?? []), ...res.data[k]];
        }
      }
      return { success: true, data: out };
    } catch (error) {
      return this.fail(error);
    }
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
      let totalItems = 0;

      do {
        if (cancelCheck && cancelCheck()) {
          return { success: false, error: 'Loading cancelled', cancelled: true };
        }

        const response: WooCommerceApiResponse<T[]> = await api.get(endpoint, { ...baseParams, page });

        if (!response.data) return { success: false, error: 'No data received' };

        allItems = [...allItems, ...response.data];

        const headers = response.headers || {};
        totalPages = parseInt(headers['x-wp-totalpages'] || '1', 10);
        totalItems = parseInt(headers['x-wp-total'] || String(allItems.length), 10);

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

      return { success: true, data: allItems, totalPages, totalItems };
    } catch (error) {
      return this.fail(error);
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
      return this.fail(error);
    }
  }
}
