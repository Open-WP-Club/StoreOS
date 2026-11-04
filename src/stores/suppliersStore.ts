import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface Supplier {
  id: string;
  name: string;
  contact: string;
  email: string;
  phone: string;
  notes: string;
}

export interface POLine {
  productId: number;
  name: string;
  sku: string;
  qty: number;
  unitCost: number;
  /** units received so far */
  received: number;
}

export type POStatus = 'draft' | 'ordered' | 'partial' | 'received';

export interface PurchaseOrder {
  id: string;
  number: number;
  supplierId: string | null;
  supplierName: string;
  lines: POLine[];
  status: POStatus;
  createdAt: string;
  orderedAt?: string;
  receivedAt?: string;
  notes: string;
}

interface StoreData {
  suppliers: Supplier[];
  orders: PurchaseOrder[];
}

interface SuppliersState {
  /** storeId -> local suppliers / purchase orders (never sent to WooCommerce). */
  byStore: Record<string, StoreData>;
  addSupplier: (storeId: string, s: Omit<Supplier, 'id'>) => Supplier;
  updateSupplier: (storeId: string, id: string, patch: Partial<Omit<Supplier, 'id'>>) => void;
  removeSupplier: (storeId: string, id: string) => void;
  addOrder: (
    storeId: string,
    o: Pick<PurchaseOrder, 'supplierId' | 'supplierName' | 'lines'> & { notes?: string }
  ) => PurchaseOrder;
  updateOrder: (
    storeId: string,
    id: string,
    patch: Partial<Pick<PurchaseOrder, 'supplierId' | 'supplierName' | 'lines' | 'notes'>>
  ) => void;
  markOrdered: (storeId: string, id: string) => void;
  removeOrder: (storeId: string, id: string) => void;
  /** Record received units per productId; status becomes partial/received. */
  recordReceipt: (storeId: string, id: string, qtys: Record<number, number>) => void;
}

const EMPTY: StoreData = { suppliers: [], orders: [] };
export const getStoreData = (byStore: SuppliersState['byStore'], storeId: string): StoreData =>
  byStore[storeId] ?? EMPTY;

/** Status implied by received quantities (draft/ordered are set explicitly). */
export function receiptStatus(lines: POLine[]): POStatus {
  if (lines.length > 0 && lines.every((l) => l.received >= l.qty)) return 'received';
  return lines.some((l) => l.received > 0) ? 'partial' : 'ordered';
}

const uid = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

const useSuppliers = create<SuppliersState>()(
  persist(
    (set, get) => {
      const patch = (storeId: string, fn: (d: StoreData) => Partial<StoreData>): void => {
        set((s) => {
          const d = getStoreData(s.byStore, storeId);
          return { byStore: { ...s.byStore, [storeId]: { ...d, ...fn(d) } } };
        });
      };
      const patchOrder = (storeId: string, id: string, fn: (o: PurchaseOrder) => PurchaseOrder) =>
        patch(storeId, (d) => ({ orders: d.orders.map((o) => (o.id === id ? fn(o) : o)) }));
      return {
        byStore: {},
        addSupplier: (storeId, s) => {
          const supplier = { ...s, id: uid() };
          patch(storeId, (d) => ({ suppliers: [...d.suppliers, supplier] }));
          return supplier;
        },
        updateSupplier: (storeId, id, p) =>
          patch(storeId, (d) => ({
            suppliers: d.suppliers.map((s) => (s.id === id ? { ...s, ...p } : s)),
          })),
        removeSupplier: (storeId, id) =>
          patch(storeId, (d) => ({ suppliers: d.suppliers.filter((s) => s.id !== id) })),
        addOrder: (storeId, o) => {
          const d = getStoreData(get().byStore, storeId);
          const order: PurchaseOrder = {
            ...o,
            notes: o.notes ?? '',
            id: uid(),
            number: Math.max(0, ...d.orders.map((x) => x.number)) + 1,
            status: 'draft',
            createdAt: new Date().toISOString(),
          };
          patch(storeId, (cur) => ({ orders: [order, ...cur.orders] }));
          return order;
        },
        updateOrder: (storeId, id, p) => patchOrder(storeId, id, (o) => ({ ...o, ...p })),
        markOrdered: (storeId, id) =>
          patchOrder(storeId, id, (o) =>
            o.status === 'draft'
              ? { ...o, status: 'ordered', orderedAt: new Date().toISOString() }
              : o
          ),
        removeOrder: (storeId, id) =>
          patch(storeId, (d) => ({ orders: d.orders.filter((o) => o.id !== id) })),
        recordReceipt: (storeId, id, qtys) =>
          patchOrder(storeId, id, (o) => {
            const lines = o.lines.map((l) => ({
              ...l,
              received: l.received + Math.max(0, qtys[l.productId] ?? 0),
            }));
            const status = receiptStatus(lines);
            return {
              ...o,
              lines,
              status,
              receivedAt: status === 'received' ? new Date().toISOString() : o.receivedAt,
            };
          }),
      };
    },
    { name: 'suppliers-store', partialize: (s) => ({ byStore: s.byStore }) }
  )
);

export default useSuppliers;
