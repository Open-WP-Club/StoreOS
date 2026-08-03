export interface StoreLoadingSettings {
  batchSize: number;
  batchDelay: number;
  posInfiniteScroll?: boolean;
  retryDelaySeconds?: number;
}

export interface WooCommerceStore {
  id: string;
  name: string;
  url: string;
  consumerKey: string;
  consumerSecret: string;
  createdAt: string;
  loadingSettings: StoreLoadingSettings;
  currency?: string;
  currencySymbol?: string;
}
