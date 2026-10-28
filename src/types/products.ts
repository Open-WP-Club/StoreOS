import type { WooCommerceMetaData } from './common';

export type ProductStatus = 'draft' | 'pending' | 'private' | 'publish';
export type ProductType = 'simple' | 'variable' | 'grouped' | 'external';
export type StockStatus = 'instock' | 'outofstock' | 'onbackorder';
export type CatalogVisibility = 'visible' | 'catalog' | 'search' | 'hidden';
export type TaxStatus = 'taxable' | 'shipping' | 'none';
export type BackorderStatus = 'no' | 'notify' | 'yes';

export interface ProductCategory {
  id: number;
  name: string;
  slug: string;
}

export interface ProductTag {
  id: number;
  name: string;
  slug: string;
}

export interface ProductImage {
  id: number;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  src: string;
  name: string;
  alt: string;
}

export interface ProductDimensions {
  length: string;
  width: string;
  height: string;
}

export interface ProductDownload {
  id: string;
  name: string;
  file: string;
}

export interface ProductAttribute {
  id: number;
  name: string;
  position: number;
  visible: boolean;
  variation: boolean;
  options: string[];
}

export interface ProductDefaultAttribute {
  id: number;
  name: string;
  option: string;
}

export interface WooCommerceProduct {
  id: number;
  name: string;
  slug: string;
  permalink: string;
  date_created: string;
  date_created_gmt: string;
  date_modified: string;
  date_modified_gmt: string;
  type: ProductType;
  status: ProductStatus;
  featured: boolean;
  catalog_visibility: CatalogVisibility;
  description: string;
  short_description: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  date_on_sale_from: string | null;
  date_on_sale_from_gmt: string | null;
  date_on_sale_to: string | null;
  date_on_sale_to_gmt: string | null;
  price_html: string;
  on_sale: boolean;
  purchasable: boolean;
  total_sales: number;
  virtual: boolean;
  downloadable: boolean;
  downloads: ProductDownload[];
  download_limit: number;
  download_expiry: number;
  external_url: string;
  button_text: string;
  tax_status: TaxStatus;
  tax_class: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  stock_status: StockStatus;
  backorders: BackorderStatus;
  backorders_allowed: boolean;
  backordered: boolean;
  sold_individually: boolean;
  weight: string;
  dimensions: ProductDimensions;
  shipping_required: boolean;
  shipping_taxable: boolean;
  shipping_class: string;
  shipping_class_id: number;
  reviews_allowed: boolean;
  average_rating: string;
  rating_count: number;
  related_ids: number[];
  upsell_ids: number[];
  cross_sell_ids: number[];
  parent_id: number;
  purchase_note: string;
  categories: ProductCategory[];
  tags: ProductTag[];
  images: ProductImage[];
  attributes: ProductAttribute[];
  default_attributes: ProductDefaultAttribute[];
  variations: number[];
  grouped_products: number[];
  menu_order: number;
  meta_data: WooCommerceMetaData[];
  global_unique_id?: string;
}

export interface VariationAttribute {
  id: number;
  name: string;
  option: string;
}

export interface ProductVariation {
  id: number;
  date_created: string;
  date_modified: string;
  description: string;
  permalink: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price: string;
  on_sale: boolean;
  status: 'publish' | 'private' | 'draft';
  purchasable: boolean;
  virtual: boolean;
  downloadable: boolean;
  manage_stock: boolean | 'parent';
  stock_quantity: number | null;
  stock_status: StockStatus;
  backorders: BackorderStatus;
  weight: string;
  dimensions: ProductDimensions;
  image: ProductImage | null;
  attributes: VariationAttribute[];
  menu_order: number;
  meta_data: WooCommerceMetaData[];
}

export interface VariationCreateData {
  regular_price?: string;
  sale_price?: string;
  status?: 'publish' | 'private' | 'draft';
  sku?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: StockStatus;
  weight?: string;
  dimensions?: Partial<ProductDimensions>;
  description?: string;
  attributes?: VariationAttribute[];
}

export interface VariationUpdateData extends VariationCreateData {
  id?: number;
}

export interface ProductUpdateData {
  name?: string;
  slug?: string;
  type?: ProductType;
  status?: ProductStatus;
  featured?: boolean;
  catalog_visibility?: CatalogVisibility;
  description?: string;
  short_description?: string;
  sku?: string;
  regular_price?: string;
  sale_price?: string;
  date_on_sale_from?: string | null;
  date_on_sale_to?: string | null;
  virtual?: boolean;
  downloadable?: boolean;
  downloads?: ProductDownload[];
  download_limit?: number;
  download_expiry?: number;
  external_url?: string;
  button_text?: string;
  tax_status?: TaxStatus;
  tax_class?: string;
  manage_stock?: boolean;
  stock_quantity?: number | null;
  stock_status?: StockStatus;
  backorders?: BackorderStatus;
  sold_individually?: boolean;
  weight?: string;
  dimensions?: Partial<ProductDimensions>;
  shipping_class?: string;
  reviews_allowed?: boolean;
  upsell_ids?: number[];
  cross_sell_ids?: number[];
  parent_id?: number;
  purchase_note?: string;
  categories?: Array<{ id: number }>;
  tags?: Array<{ id: number } | { name: string }>;
  images?: Array<{ id?: number; src?: string; name?: string; alt?: string }>;
  attributes?: ProductAttribute[];
  default_attributes?: ProductDefaultAttribute[];
  menu_order?: number;
  meta_data?: WooCommerceMetaData[];
}

export interface ProductQueryParams {
  context?: 'view' | 'edit';
  _fields?: string;
  page?: number;
  per_page?: number;
  search?: string;
  after?: string;
  before?: string;
  modified_after?: string;
  modified_before?: string;
  dates_are_gmt?: boolean;
  exclude?: number[];
  include?: number[];
  offset?: number;
  order?: 'asc' | 'desc';
  orderby?: 'date' | 'id' | 'include' | 'title' | 'slug' | 'price' | 'popularity' | 'rating' | 'modified';
  parent?: number[];
  parent_exclude?: number[];
  slug?: string;
  status?: ProductStatus;
  type?: ProductType;
  sku?: string;
  featured?: boolean;
  category?: string;
  tag?: string;
  shipping_class?: string;
  attribute?: string;
  attribute_term?: string;
  tax_class?: string;
  on_sale?: boolean;
  min_price?: string;
  max_price?: string;
  stock_status?: StockStatus;
}

export interface ProductFilters {
  stockStatus: string;
  status: string;
  priceMin: string;
  priceMax: string;
  stockMin: string;
  stockMax: string;
}

export interface BatchProductUpdate {
  id: number;
  [key: string]: unknown;
}

export interface WooCommerceProductCategory {
  id: number;
  name: string;
  slug: string;
  parent: number;
  description: string;
  display: 'default' | 'products' | 'subcategories' | 'both';
  image: ProductImage | null;
  menu_order: number;
  count: number;
}

export interface ProductCategoryUpdateData {
  name?: string;
  slug?: string;
  parent?: number;
  description?: string;
  display?: 'default' | 'products' | 'subcategories' | 'both';
  image?: { id?: number; src?: string; name?: string; alt?: string } | null;
  menu_order?: number;
}

export interface ProductCategoryQueryParams {
  context?: 'view' | 'edit';
  page?: number;
  per_page?: number;
  search?: string;
  exclude?: number[];
  include?: number[];
  order?: 'asc' | 'desc';
  orderby?: 'id' | 'include' | 'name' | 'slug' | 'term_group' | 'description' | 'count';
  hide_empty?: boolean;
  parent?: number;
  product?: number;
  slug?: string;
}

export interface WooCommerceProductAttribute {
  id: number;
  name: string;
  slug: string;
  type: string;
  order_by: 'menu_order' | 'name' | 'name_num' | 'id';
  has_archives: boolean;
}

export interface ProductAttributeUpdateData {
  name?: string;
  slug?: string;
  type?: string;
  order_by?: 'menu_order' | 'name' | 'name_num' | 'id';
  has_archives?: boolean;
}

export interface WooCommerceAttributeTerm {
  id: number;
  name: string;
  slug: string;
  description: string;
  menu_order: number;
  count: number;
}

export interface AttributeTermUpdateData {
  name?: string;
  slug?: string;
  description?: string;
  menu_order?: number;
}
