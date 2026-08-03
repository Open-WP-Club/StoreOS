import { useState, useMemo } from 'react';
import { useCachedOrders, useCachedProducts } from '../stores';
import { calculateAllKPIs } from '../utils/kpiCalculator';
import { getCurrencyCode } from '../utils/currency';
import type { AllKPIs } from '../utils/kpiCalculator';

export type KPIPeriod = 7 | 30 | 90 | 365;

interface UseKPIsResult {
  kpis: AllKPIs | null;
  loading: boolean;
  period: KPIPeriod;
  setPeriod: (p: KPIPeriod) => void;
  currencyCode: string;
  hasData: boolean;
}

export function useKPIs(): UseKPIsResult {
  const orders = useCachedOrders();
  const products = useCachedProducts();
  const [period, setPeriod] = useState<KPIPeriod>(30);

  const currencyCode = useMemo(() => {
    if (orders.length > 0) return getCurrencyCode(orders);
    return 'USD';
  }, [orders]);

  const hasData = orders.length > 0 || products.length > 0;

  const kpis = useMemo(() => {
    if (!hasData) return null;
    return calculateAllKPIs(orders, products, period);
  }, [orders, products, period, hasData]);

  return {
    kpis,
    loading: false,
    period,
    setPeriod,
    currencyCode,
    hasData,
  };
}
