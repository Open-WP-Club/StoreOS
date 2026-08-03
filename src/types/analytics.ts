export interface SalesMetrics {
  totalRevenue: number;
  orderCount: number;
  averageOrderValue: number;
  itemsSold: number;
}

export interface DateRangeMetrics extends SalesMetrics {
  startDate: string;
  endDate: string;
}

export interface ProductSalesData {
  productId: number;
  productName: string;
  quantitySold: number;
  revenue: number;
}
