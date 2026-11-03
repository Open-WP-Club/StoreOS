import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomerNote {
  tags: string[];
  notes: string;
  /** epoch ms of the last local edit; used to decide remote-vs-local when sync is on */
  updatedAt?: number;
}

interface CustomerNotesState {
  /** storeId -> customerId -> local tags/notes (never sent to WooCommerce). */
  byStore: Record<string, Record<number, CustomerNote>>;
  addTag: (storeId: string, customerId: number, tag: string) => void;
  removeTag: (storeId: string, customerId: number, tag: string) => void;
  setNotes: (storeId: string, customerId: number, notes: string) => void;
  /**
   * Merge a profile read from WooCommerce meta_data. Rule: the remote copy is adopted only if it
   * is strictly newer than the last local edit (updatedAt); otherwise local is kept and will be
   * pushed on the next save, so a newer local edit is never silently overwritten.
   */
  mergeRemote: (storeId: string, customerId: number, remote: Required<CustomerNote>) => void;
}

const EMPTY: CustomerNote = { tags: [], notes: '' };

export const getCustomerNote = (
  byStore: CustomerNotesState['byStore'],
  storeId: string,
  customerId: number
): CustomerNote => byStore[storeId]?.[customerId] ?? EMPTY;

const useCustomerNotes = create<CustomerNotesState>()(
  persist(
    (set, get) => {
      const patch = (storeId: string, id: number, fn: (n: CustomerNote) => CustomerNote): void =>
        void set((s) => ({
          byStore: {
            ...s.byStore,
            [storeId]: {
              ...s.byStore[storeId],
              [id]: fn(getCustomerNote(s.byStore, storeId, id)),
            },
          },
        }));
      return {
        byStore: {},
        addTag: (storeId, id, tag) => {
          const t = tag.trim().toLowerCase();
          if (!t) return;
          patch(storeId, id, (n) =>
            n.tags.includes(t) ? n : { ...n, tags: [...n.tags, t], updatedAt: Date.now() }
          );
        },
        removeTag: (storeId, id, tag) =>
          patch(storeId, id, (n) => ({
            ...n,
            tags: n.tags.filter((x) => x !== tag),
            updatedAt: Date.now(),
          })),
        setNotes: (storeId, id, notes) =>
          patch(storeId, id, (n) => ({ ...n, notes, updatedAt: Date.now() })),
        mergeRemote: (storeId, id, remote) => {
          const cur = getCustomerNote(get().byStore, storeId, id);
          if (remote.updatedAt > (cur.updatedAt ?? 0)) patch(storeId, id, () => remote);
        },
      };
    },
    { name: 'customer-notes', partialize: (s) => ({ byStore: s.byStore }) }
  )
);

export default useCustomerNotes;
