export interface ApiSuccessResponse<T> {
  success: true;
  data: T;
  headers?: Record<string, string>;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  cancelled?: boolean;
}

export type ApiResponse<T> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface PaginatedSuccessResponse<T> extends ApiSuccessResponse<T[]> {
  totalPages: number;
  totalItems?: number;
}

export type PaginatedApiResponse<T> = PaginatedSuccessResponse<T> | ApiErrorResponse;

export interface BatchLoadProgress<T = unknown> {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  batchData: T[];
  allData: T[];
  progress: number;
}

export type OnBatchLoaded<T = unknown> = (progress: BatchLoadProgress<T>) => void;

export interface BatchOperationRequest<T = unknown> {
  create?: T[];
  update?: T[];
  delete?: number[];
}

export interface BatchOperationResponse<T> {
  create?: T[];
  update?: T[];
  delete?: T[];
}
