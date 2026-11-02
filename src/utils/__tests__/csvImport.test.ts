import { describe, it, expect } from 'vitest';
import { parseCSV, autoMapHeaders, computeImportDiff, chunk } from '../csvImport';
import type { Product } from '../../types';

const prod = (o: Record<string, unknown>): Product => o as unknown as Product;

describe('parseCSV', () => {
  it('handles quotes, commas, newlines, CRLF and BOM', () => {
    const csv = '﻿a,b\r\n"x, ""y""","line1\nline2"\r\n\r\nlast,';
    expect(parseCSV(csv)).toEqual([
      ['a', 'b'],
      ['x, "y"', 'line1\nline2'],
      ['last', ''],
    ]);
  });
  it('returns [] for empty input', () => {
    expect(parseCSV('')).toEqual([]);
  });
});

describe('autoMapHeaders', () => {
  it('maps the app export format', () => {
    const m = autoMapHeaders([
      'Product ID',
      'Product Name',
      'SKU',
      'Price',
      'Regular Price',
      'Stock',
      'Stock Status',
      'Status',
    ]);
    expect(m).toMatchObject({
      sku: 2,
      name: 1,
      regular_price: 4,
      stock_quantity: 5,
      stock_status: 6,
      status: 7,
      sale_price: -1,
    });
  });
});

describe('computeImportDiff', () => {
  const header = ['SKU', 'Product Name', 'Regular Price', 'Stock'];
  const mapping = autoMapHeaders(header);
  const products = [
    prod({ id: 1, sku: 'A', name: 'Alpha', regular_price: '10.00', stock_quantity: 5 }),
    prod({ id: 2, sku: 'A2', name: 'x', regular_price: '2', stock_quantity: 1 }),
  ];

  it('classifies create / update / unchanged', () => {
    const rows = [
      header,
      ['A', 'Alpha', '10', '5'],
      ['A2', 'x', '1', ''],
      ['B', 'Beta', '3.5', '2'],
    ];
    const d = computeImportDiff(rows, mapping, products);
    expect(d.map((r) => r.action)).toEqual(['unchanged', 'update', 'create']);
    expect(d[1]?.changes).toEqual([{ field: 'regular_price', from: '2', to: '1' }]);
    expect(d[2]?.payload).toMatchObject({
      sku: 'B',
      name: 'Beta',
      stock_quantity: 2,
      manage_stock: true,
    });
  });

  it('flags invalid rows', () => {
    const rows = [
      header,
      ['', 'N', '1', '1'],
      ['A', 'Alpha', '-5', '1'],
      ['C', '', '1', '1'],
      ['A', 'Alpha', '1', '1'],
      ['D', 'D', '1', '1.5'],
    ];
    const d = computeImportDiff(rows, mapping, products);
    expect(d.every((r) => r.action === 'invalid')).toBe(true);
    expect(d[0]?.errors).toContain('Missing SKU');
    expect(d[1]?.errors[0]).toMatch(/non-negative/);
    expect(d[2]?.errors[0]).toMatch(/Name is required/);
    expect(d[3]?.errors).toContain('Duplicate SKU in file');
    expect(d[4]?.errors[0]).toMatch(/integer/);
  });
});

describe('chunk', () => {
  it('splits by size', () => {
    expect(chunk([1, 2, 3, 4, 5], 2)).toEqual([[1, 2], [3, 4], [5]]);
  });
});
