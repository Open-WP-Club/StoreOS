import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import type { ChangeEvent } from 'react';
import { useAnalyticsBase } from '../useAnalyticsBase';
import { formatShortDate } from '../../utils/dateTime';

describe('useAnalyticsBase', () => {
  it('defaults to 1 Month and updates label on change', () => {
    const { result } = renderHook(() => useAnalyticsBase());
    expect(result.current.selectedTimeRange).toBe(30);
    expect(result.current.timeRangeLabel).toBe('1 Month');
    expect(result.current.formatCurrency(5)).toContain('5');
    act(() => {
      result.current.handleTimeRangeChange({
        target: { value: '90' },
      } as ChangeEvent<HTMLSelectElement>);
    });
    expect(result.current.timeRangeLabel).toBe('3 Months');
  });
});

describe('formatShortDate', () => {
  it('formats as short month and day', () => {
    expect(formatShortDate('2024-03-05T12:00:00')).toBe('Mar 5');
  });
});
