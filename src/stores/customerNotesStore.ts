import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export interface CustomerNote {
  tags: string[];
  notes: string;
}

interface CustomerNotesState {
  /** storeId -> customerId -> local tags/notes (never sent to WooCommerce). */
  byStore: Record<string, Record<number, CustomerNote>>;
  addTag: (storeId: string, customerId: number, tag: string) => void;
  removeTag: (storeId: string, customerId: number, tag: string) => void;
  setNotes: (storeId: string, customerId: number, notes: string) => void;
}

const EMPTY: CustomerNote = { tags: [], notes: '' };

export const getCustomerNote = (
  byStore: CustomerNotesState['byStore'],
  storeId: string,
  customerId: number
): CustomerNote => byStore[storeId]?.[customerId] ?? EMPTY;

const useCustomerNotes = create<CustomerNotesState>()(
  persist(
    (set) => {
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
          patch(storeId, id, (n) => (n.tags.includes(t) ? n : { ...n, tags: [...n.tags, t] }));
        },
        removeTag: (storeId, id, tag) =>
          patch(storeId, id, (n) => ({ ...n, tags: n.tags.filter((x) => x !== tag) })),
        setNotes: (storeId, id, notes) => patch(storeId, id, (n) => ({ ...n, notes })),
      };
    },
    { name: 'customer-notes', partialize: (s) => ({ byStore: s.byStore }) }
  )
);

export default useCustomerNotes;
