import { useState, type ChangeEvent } from 'react';
import { TIME_RANGES } from '../constants/timeRanges';
import { formatCurrency as formatCurrencyUtil } from '../utils/currency';

/** Shared analytics-page state: currency, selected time range, and formatters. */
export function useAnalyticsBase(initialRange = 30) {
  const [currencyCode, setCurrencyCode] = useState<string>('USD');
  const [selectedTimeRange, setSelectedTimeRange] = useState<number>(initialRange);

  const handleTimeRangeChange = (e: ChangeEvent<HTMLSelectElement>): void => {
    setSelectedTimeRange(parseInt(e.target.value));
  };
  const timeRangeLabel = TIME_RANGES.find((r) => r.value === selectedTimeRange)?.label || '';
  const formatCurrency = (amount: number): string => formatCurrencyUtil(amount, currencyCode);

  return {
    currencyCode,
    setCurrencyCode,
    selectedTimeRange,
    setSelectedTimeRange,
    handleTimeRangeChange,
    timeRangeLabel,
    formatCurrency,
  };
}
