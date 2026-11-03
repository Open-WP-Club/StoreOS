import { describe, it, expect } from 'vitest';
import { isStockAtOrBelow, isLowButInStock, isOutOfStock } from '../stock';

describe('isStockAtOrBelow', () => {
  it('is inclusive and ignores unknown stock', () => {
    expect(isStockAtOrBelow(5, 5)).toBe(true);
    expect(isStockAtOrBelow(6, 5)).toBe(false);
    expect(isStockAtOrBelow(null, 5)).toBe(false);
    expect(isStockAtOrBelow(undefined, 5)).toBe(false);
  });
});

describe('isLowButInStock', () => {
  it('is true only for 1..threshold', () => {
    expect(isLowButInStock(1, 5)).toBe(true);
    expect(isLowButInStock(5, 5)).toBe(true);
    expect(isLowButInStock(6, 5)).toBe(false);
    expect(isLowButInStock(0, 5)).toBe(false);
    expect(isLowButInStock(null, 5)).toBe(false);
    expect(isLowButInStock(undefined, 5)).toBe(false);
  });
});

describe('isOutOfStock', () => {
  it('checks stock_status', () => {
    expect(isOutOfStock({ stock_status: 'outofstock' })).toBe(true);
    expect(isOutOfStock({ stock_status: 'instock' })).toBe(false);
    expect(isOutOfStock({})).toBe(false);
  });
});
