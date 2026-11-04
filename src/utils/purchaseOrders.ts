import type { POLine, PurchaseOrder } from '../stores/suppliersStore';

export const poTotal = (lines: POLine[]): number =>
  Math.round(lines.reduce((s, l) => s + l.qty * l.unitCost, 0) * 100) / 100;

/** Group reorder rows (qty > 0) into one set of PO lines per supplier name. */
export function groupReorderBySupplier(
  rows: Array<{ id: number; name: string; sku: string; supplier: string; orderQty: number }>,
  costOf: (productId: number) => number = () => 0
): Map<string, POLine[]> {
  const out = new Map<string, POLine[]>();
  for (const r of rows) {
    if (r.orderQty <= 0) continue;
    const line: POLine = {
      productId: r.id,
      name: r.name,
      sku: r.sku,
      qty: r.orderQty,
      unitCost: costOf(r.id),
      received: 0,
    };
    out.set(r.supplier, [...(out.get(r.supplier) ?? []), line]);
  }
  return out;
}

/** Rows for CSV/PDF export (text cells are formula-neutralized by csvExport). */
export const poExportRows = (
  po: PurchaseOrder
): Array<{
  name: string;
  sku: string;
  qty: number;
  received: number;
  unitCost: number;
  total: number;
}> =>
  po.lines.map((l) => ({
    name: l.name,
    sku: l.sku,
    qty: l.qty,
    received: l.received,
    unitCost: l.unitCost,
    total: Math.round(l.qty * l.unitCost * 100) / 100,
  }));

export const poExportColumns = [
  { key: 'name', label: 'Product' },
  { key: 'sku', label: 'SKU' },
  { key: 'qty', label: 'Ordered' },
  { key: 'received', label: 'Received' },
  { key: 'unitCost', label: 'Unit cost' },
  { key: 'total', label: 'Total' },
];
