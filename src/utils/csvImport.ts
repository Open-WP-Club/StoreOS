/**
 * CSV product import: parser, column mapping, validation and diff against cached products.
 * Everything coming from the file is untrusted text: never render it as HTML.
 */
import type { Product } from '../types';

export type ImportField =
  | 'sku'
  | 'name'
  | 'regular_price'
  | 'sale_price'
  | 'stock_quantity'
  | 'stock_status'
  | 'status';

export const IMPORT_FIELDS: { field: ImportField; label: string; aliases: string[] }[] = [
  { field: 'sku', label: 'SKU', aliases: ['sku'] },
  { field: 'name', label: 'Name', aliases: ['product name', 'name'] },
  { field: 'regular_price', label: 'Regular price', aliases: ['regular price', 'regular_price'] },
  { field: 'sale_price', label: 'Sale price', aliases: ['sale price', 'sale_price'] },
  { field: 'stock_quantity', label: 'Stock quantity', aliases: ['stock', 'stock quantity', 'stock_quantity'] },
  { field: 'stock_status', label: 'Stock status', aliases: ['stock status', 'stock_status'] },
  { field: 'status', label: 'Status', aliases: ['status'] },
];

/** field -> column index, -1 = not mapped */
export type ColumnMapping = Record<ImportField, number>;

const STOCK_STATUSES = ['instock', 'outofstock', 'onbackorder'];
const STATUSES = ['draft', 'pending', 'private', 'publish'];

/** RFC-4180-ish parser: quotes, escaped quotes, commas/newlines in quotes, CRLF, BOM. */
export function parseCSV(input: string): string[][] {
  const text = input.charCodeAt(0) === 0xfeff ? input.slice(1) : input;
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          cell += '"';
          i++;
        } else quoted = false;
      } else cell += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      row.push(cell);
      cell = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  if (cell !== '' || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  // drop fully blank lines
  return rows.filter((r) => r.some((v) => v.trim() !== ''));
}

export function autoMapHeaders(headers: string[]): ColumnMapping {
  const norm = headers.map((h) => h.trim().toLowerCase());
  const mapping = {} as ColumnMapping;
  for (const { field, aliases } of IMPORT_FIELDS) {
    mapping[field] = norm.findIndex((h) => aliases.includes(h));
  }
  return mapping;
}

export type ImportAction = 'create' | 'update' | 'unchanged' | 'invalid';

export interface FieldChange {
  field: ImportField;
  from: string;
  to: string;
}

export interface ImportRow {
  /** 1-based line number in the file (header = 1) */
  line: number;
  sku: string;
  action: ImportAction;
  /** existing product id for updates */
  id?: number;
  changes: FieldChange[];
  errors: string[];
  /** payload sent to WooCommerce (only changed / new fields) */
  payload: Record<string, unknown>;
}

const isMoney = (v: string): boolean => /^\d+(\.\d+)?$/.test(v);
const isNumeric = (f: ImportField): boolean =>
  f === 'regular_price' || f === 'sale_price' || f === 'stock_quantity';
const sameValue = (f: ImportField, a: string, b: string): boolean =>
  isNumeric(f) && a !== '' && b !== '' && !isNaN(Number(a)) && !isNaN(Number(b))
    ? Number(a) === Number(b)
    : a === b;

function currentValue(p: Product, field: ImportField): string {
  const v = (p as unknown as Record<string, unknown>)[field];
  return v == null ? '' : String(v);
}

/** Validate a single cell; returns an error message or null. */
function validate(field: ImportField, v: string): string | null {
  switch (field) {
    case 'regular_price':
    case 'sale_price':
      return isMoney(v) ? null : `${field} must be a non-negative number (got "${v}")`;
    case 'stock_quantity':
      return /^-?\d+$/.test(v) ? null : `stock_quantity must be an integer (got "${v}")`;
    case 'stock_status':
      return STOCK_STATUSES.includes(v) ? null : `stock_status must be one of ${STOCK_STATUSES.join('/')}`;
    case 'status':
      return STATUSES.includes(v) ? null : `status must be one of ${STATUSES.join('/')}`;
    default:
      return null;
  }
}

/**
 * Compute create/update/unchanged/invalid per data row (rows[0] is the header).
 * Empty cells are skipped (never clear a value). Matching is by SKU, case-sensitive.
 */
export function computeImportDiff(
  rows: string[][],
  mapping: ColumnMapping,
  products: Product[]
): ImportRow[] {
  const bySku = new Map<string, Product>();
  for (const p of products) if (p.sku) bySku.set(p.sku, p);
  const seen = new Set<string>();
  const cell = (r: string[], f: ImportField): string =>
    mapping[f] >= 0 ? (r[mapping[f]] ?? '').trim() : '';

  return rows.slice(1).map((r, i) => {
    const sku = cell(r, 'sku');
    const out: ImportRow = { line: i + 2, sku, action: 'invalid', changes: [], errors: [], payload: {} };
    if (mapping.sku < 0) out.errors.push('SKU column is not mapped');
    else if (!sku) out.errors.push('Missing SKU');
    else if (seen.has(sku)) out.errors.push('Duplicate SKU in file');
    seen.add(sku);

    const existing = sku ? bySku.get(sku) : undefined;
    const values: { field: ImportField; value: string }[] = [];
    for (const { field } of IMPORT_FIELDS) {
      if (field === 'sku') continue;
      const value = cell(r, field);
      if (value === '') continue;
      const err = validate(field, value);
      if (err) out.errors.push(err);
      else values.push({ field, value });
    }
    if (!existing && sku && !values.some((v) => v.field === 'name')) {
      out.errors.push('Name is required to create a product');
    }
    if (out.errors.length) return out;

    if (existing) out.id = existing.id;
    for (const { field, value } of values) {
      const from = existing ? currentValue(existing, field) : '';
      if (existing && sameValue(field, from, value)) continue;
      out.changes.push({ field, from, to: value });
      out.payload[field] = field === 'stock_quantity' ? Number(value) : value;
      if (field === 'stock_quantity') out.payload.manage_stock = true;
    }
    if (!existing) out.payload.sku = sku;
    out.action = !existing ? 'create' : out.changes.length ? 'update' : 'unchanged';
    return out;
  });
}

/** Split into chunks for batch API calls (WooCommerce caps batches at 100). */
export function chunk<T>(items: T[], size = 100): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}
