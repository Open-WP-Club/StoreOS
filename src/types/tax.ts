export interface WooCommerceTaxRate {
  id: number;
  country: string;
  state: string;
  postcode: string;
  city: string;
  postcodes: string[];
  cities: string[];
  rate: string;
  name: string;
  priority: number;
  compound: boolean;
  shipping: boolean;
  order: number;
  class: string;
  /** UI-only: optimistic placeholder for a create queued offline (never persisted). */
  _pending?: boolean;
}

export interface TaxRateUpdateData {
  country?: string;
  state?: string;
  postcode?: string;
  city?: string;
  postcodes?: string[];
  cities?: string[];
  rate?: string;
  name?: string;
  priority?: number;
  compound?: boolean;
  shipping?: boolean;
  order?: number;
  class?: string;
}

export interface WooCommerceTaxClass {
  slug: string;
  name: string;
  /** Temp id of a class queued offline (only on `_pending` placeholders). */
  id?: number;
  _pending?: boolean;
}

export interface TaxClassCreateData {
  name: string;
}
