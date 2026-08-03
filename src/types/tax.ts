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
}

export interface TaxClassCreateData {
  name: string;
}
