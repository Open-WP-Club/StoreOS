export type ReviewStatus = 'approved' | 'hold' | 'spam' | 'unspam' | 'trash' | 'untrash';

export interface WooCommerceReview {
  id: number;
  date_created: string;
  date_created_gmt: string;
  product_id: number;
  product_name?: string;
  product_permalink?: string;
  status: 'approved' | 'hold' | 'spam' | 'trash';
  reviewer: string;
  reviewer_email: string;
  review: string;
  rating: number;
  verified: boolean;
  reviewer_avatar_urls?: Record<string, string>;
}

export interface ReviewUpdateData {
  review?: string;
  rating?: number;
  status?: ReviewStatus;
  reviewer?: string;
  reviewer_email?: string;
  product_id?: number;
}

export interface ReviewQueryParams {
  context?: 'view' | 'edit';
  page?: number;
  per_page?: number;
  search?: string;
  after?: string;
  before?: string;
  exclude?: number[];
  include?: number[];
  offset?: number;
  order?: 'asc' | 'desc';
  orderby?: 'date' | 'date_gmt' | 'id' | 'include' | 'product';
  reviewer?: number[];
  reviewer_exclude?: number[];
  reviewer_email?: string[];
  product?: number[];
  status?: 'approved' | 'hold' | 'spam' | 'trash' | 'all';
}
