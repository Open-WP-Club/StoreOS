import type {
  WooCommerceProduct,
  ProductQueryParams,
  ProductUpdateData,
  BatchProductUpdate,
  BatchOperationResponse,
  ProductVariation,
  VariationCreateData,
  VariationUpdateData,
  WooCommerceProductCategory,
  ProductCategoryUpdateData,
  ProductCategoryQueryParams,
  WooCommerceProductAttribute,
  ProductAttributeUpdateData,
  WooCommerceAttributeTerm,
  AttributeTermUpdateData,
  StockStatus,
  ApiResponse,
  PaginatedApiResponse,
  OnBatchLoaded,
} from '../../types';
import { type WooCommerceApiResponse, type PaginatedFetchOptions } from './base';
import { WooCommerceServiceOrders } from './orders';

export class WooCommerceServiceProducts extends WooCommerceServiceOrders {
  // ============================================
  // Products
  // ============================================

  async getProducts(
    params: ProductQueryParams = {}
  ): Promise<ApiResponse<WooCommerceProduct[]> & { headers?: Record<string, string> }> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProduct[]> =
        await (await this.getApi()).get('products', params);
      return { success: true, data: response.data, headers: response.headers };
    } catch (error) {
      return this.fail(error);
    }
  }

  async getAllProducts(
    params: ProductQueryParams = {},
    onBatchLoaded: OnBatchLoaded<WooCommerceProduct> | null = null,
    options: PaginatedFetchOptions = {}
  ): Promise<PaginatedApiResponse<WooCommerceProduct>> {
    return this.paginatedFetch<WooCommerceProduct, ProductQueryParams>(
      'products',
      { ...params, orderby: 'id', order: 'desc' },
      onBatchLoaded,
      options
    );
  }

  async getProductsSince(
    lastSync: string,
    params: ProductQueryParams = {},
    onBatchLoaded: OnBatchLoaded<WooCommerceProduct> | null = null,
    options: PaginatedFetchOptions = {}
  ): Promise<PaginatedApiResponse<WooCommerceProduct>> {
    return this.paginatedFetch<WooCommerceProduct, ProductQueryParams>(
      'products',
      { ...params, modified_after: lastSync, orderby: 'modified', order: 'desc' },
      onBatchLoaded,
      options
    );
  }

  async getProduct(id: number): Promise<ApiResponse<WooCommerceProduct>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProduct> =
        await (await this.getApi()).get(`products/${id}`);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async updateProduct(id: number, data: ProductUpdateData): Promise<ApiResponse<WooCommerceProduct>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProduct> =
        await (await this.getApi()).put(`products/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async createProduct(data: ProductUpdateData): Promise<ApiResponse<WooCommerceProduct>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProduct> =
        await (await this.getApi()).post('products', data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async deleteProduct(id: number): Promise<ApiResponse<WooCommerceProduct>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProduct> =
        await (await this.getApi()).delete(`products/${id}`, { force: true });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async getProductsMinimal(
    params: ProductQueryParams = {}
  ): Promise<ApiResponse<Partial<WooCommerceProduct>[]>> {
    try {
      const response: WooCommerceApiResponse<Partial<WooCommerceProduct>[]> =
        await (await this.getApi()).get('products', {
          ...params,
          _fields: 'id,name,sku,price,regular_price,sale_price,stock_quantity,stock_status,status,images',
        });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  // ============================================
  // Batch Operations
  // ============================================

  async batchUpdateProducts(
    updates: BatchProductUpdate | BatchProductUpdate[]
  ): Promise<ApiResponse<BatchOperationResponse<WooCommerceProduct>>> {
    try {
      const response: WooCommerceApiResponse<BatchOperationResponse<WooCommerceProduct>> =
        await (await this.getApi()).post('products/batch', {
          update: Array.isArray(updates) ? updates : [updates],
        });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async batchUpdateProductsChunked(
    updates: BatchProductUpdate[],
    onProgress?: (completed: number, total: number) => void
  ): Promise<ApiResponse<{ updated: WooCommerceProduct[]; errors: string[] }>> {
    try {
      const chunks: BatchProductUpdate[][] = [];
      for (let i = 0; i < updates.length; i += this.BATCH_SIZE) {
        chunks.push(updates.slice(i, i + this.BATCH_SIZE));
      }

      const allUpdated: WooCommerceProduct[] = [];
      const allErrors: string[] = [];
      let completed = 0;

      for (const chunk of chunks) {
        const result = await this.batchUpdateProducts(chunk);
        if (result.success) {
          if (result.data.update) allUpdated.push(...result.data.update);
        } else {
          allErrors.push(result.error);
        }
        completed += chunk.length;
        onProgress?.(completed, updates.length);
        if (chunks.indexOf(chunk) < chunks.length - 1) {
          await new Promise((resolve) => setTimeout(resolve, 500));
        }
      }

      if (allErrors.length > 0) {
        return {
          success: false,
          data: { updated: allUpdated, errors: allErrors },
          error: allErrors.join('; '),
        } as unknown as ApiResponse<{ updated: WooCommerceProduct[]; errors: string[] }>;
      }
      return { success: true, data: { updated: allUpdated, errors: [] } };
    } catch (error) {
      return this.fail(error);
    }
  }

  // ============================================
  // Inventory
  // ============================================

  async updateStock(
    productId: number,
    quantity: number,
    stockStatus: StockStatus = 'instock'
  ): Promise<ApiResponse<WooCommerceProduct>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProduct> =
        await (await this.getApi()).put(`products/${productId}`, {
          stock_quantity: quantity,
          stock_status: stockStatus,
          manage_stock: true,
        });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async getLowStockProducts(threshold: number = 5): Promise<ApiResponse<WooCommerceProduct[]>> {
    try {
      const result = await this.getAllProducts({ stock_status: 'instock', per_page: 25 });
      if (!result.success) return result;
      return {
        success: true,
        data: result.data.filter(
          (p) => p.stock_quantity !== null && p.stock_quantity <= threshold
        ),
      };
    } catch (error) {
      return this.fail(error);
    }
  }

  // ============================================
  // Product Variations
  // ============================================

  async getProductVariations(
    productId: number,
    params: { per_page?: number } = {}
  ): Promise<ApiResponse<ProductVariation[]>> {
    try {
      const response: WooCommerceApiResponse<ProductVariation[]> =
        await (await this.getApi()).get(`products/${productId}/variations`, {
          per_page: params.per_page || 100,
        });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async createProductVariation(
    productId: number,
    data: VariationCreateData
  ): Promise<ApiResponse<ProductVariation>> {
    try {
      const response: WooCommerceApiResponse<ProductVariation> =
        await (await this.getApi()).post(`products/${productId}/variations`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async updateProductVariation(
    productId: number,
    variationId: number,
    data: VariationUpdateData
  ): Promise<ApiResponse<ProductVariation>> {
    try {
      const response: WooCommerceApiResponse<ProductVariation> =
        await (await this.getApi()).put(`products/${productId}/variations/${variationId}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async deleteProductVariation(
    productId: number,
    variationId: number
  ): Promise<ApiResponse<ProductVariation>> {
    try {
      const response: WooCommerceApiResponse<ProductVariation> =
        await (await this.getApi()).delete(
          `products/${productId}/variations/${variationId}`,
          { force: true }
        );
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async batchProductVariations(
    productId: number,
    batch: { create?: VariationCreateData[]; update?: VariationUpdateData[]; delete?: number[] }
  ): Promise<ApiResponse<BatchOperationResponse<ProductVariation>>> {
    try {
      const response: WooCommerceApiResponse<BatchOperationResponse<ProductVariation>> =
        await (await this.getApi()).post(`products/${productId}/variations/batch`, batch);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  // ============================================
  // Product Categories
  // ============================================

  async getProductCategories(
    params: ProductCategoryQueryParams = {}
  ): Promise<ApiResponse<WooCommerceProductCategory[]>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProductCategory[]> =
        await (await this.getApi()).get('products/categories', { per_page: 100, ...params });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async createProductCategory(
    data: ProductCategoryUpdateData
  ): Promise<ApiResponse<WooCommerceProductCategory>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProductCategory> =
        await (await this.getApi()).post('products/categories', data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async updateProductCategory(
    id: number,
    data: ProductCategoryUpdateData
  ): Promise<ApiResponse<WooCommerceProductCategory>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProductCategory> =
        await (await this.getApi()).put(`products/categories/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async deleteProductCategory(id: number): Promise<ApiResponse<WooCommerceProductCategory>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProductCategory> =
        await (await this.getApi()).delete(`products/categories/${id}`, { force: true });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  // ============================================
  // Product Attributes
  // ============================================

  async getProductAttributes(): Promise<ApiResponse<WooCommerceProductAttribute[]>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProductAttribute[]> =
        await (await this.getApi()).get('products/attributes');
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async createProductAttribute(
    data: ProductAttributeUpdateData
  ): Promise<ApiResponse<WooCommerceProductAttribute>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProductAttribute> =
        await (await this.getApi()).post('products/attributes', data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async updateProductAttribute(
    id: number,
    data: ProductAttributeUpdateData
  ): Promise<ApiResponse<WooCommerceProductAttribute>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProductAttribute> =
        await (await this.getApi()).put(`products/attributes/${id}`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async deleteProductAttribute(id: number): Promise<ApiResponse<WooCommerceProductAttribute>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceProductAttribute> =
        await (await this.getApi()).delete(`products/attributes/${id}`, { force: true });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async getAttributeTerms(attributeId: number): Promise<ApiResponse<WooCommerceAttributeTerm[]>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceAttributeTerm[]> =
        await (await this.getApi()).get(`products/attributes/${attributeId}/terms`, { per_page: 100 });
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async createAttributeTerm(
    attributeId: number,
    data: AttributeTermUpdateData
  ): Promise<ApiResponse<WooCommerceAttributeTerm>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceAttributeTerm> =
        await (await this.getApi()).post(`products/attributes/${attributeId}/terms`, data);
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async updateAttributeTerm(
    attributeId: number,
    termId: number,
    data: AttributeTermUpdateData
  ): Promise<ApiResponse<WooCommerceAttributeTerm>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceAttributeTerm> =
        await (await this.getApi()).put(
          `products/attributes/${attributeId}/terms/${termId}`,
          data
        );
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async deleteAttributeTerm(
    attributeId: number,
    termId: number
  ): Promise<ApiResponse<WooCommerceAttributeTerm>> {
    try {
      const response: WooCommerceApiResponse<WooCommerceAttributeTerm> =
        await (await this.getApi()).delete(
          `products/attributes/${attributeId}/terms/${termId}`,
          { force: true }
        );
      return { success: true, data: response.data };
    } catch (error) {
      return this.fail(error);
    }
  }

  async batchProducts(ops: {
    create?: ProductUpdateData[];
    update?: BatchProductUpdate[];
    delete?: number[];
  }): Promise<ApiResponse<BatchOperationResponse<WooCommerceProduct>>> {
    return this.batchResource<WooCommerceProduct>('products', ops);
  }
}
