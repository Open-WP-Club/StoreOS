import { useState, useEffect, useCallback, FormEvent } from 'react';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import type { Order, OrderNote } from '../types';

const NOT_SYNCED = Symbol('not-synced');

interface UseOrderNotesResult {
  notes: OrderNote[];
  newNote: string;
  isCustomerNote: boolean;
  loadingNotes: boolean;
  savingNote: boolean;
  deletingNoteId: number | null;
  setNewNote: (note: string) => void;
  setIsCustomerNote: (value: boolean) => void;
  handleAddNote: (e: FormEvent) => Promise<void>;
  handleDeleteNote: (noteId: number) => Promise<void>;
}

/**
 * Hook for managing order notes: fetching, adding, and deleting.
 */
export function useOrderNotes(
  order: Order | null,
  showToast: (message: string, type: 'success' | 'error' | 'info') => void
): UseOrderNotesResult {
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const activeStore = getCurrentStore();

  const [notes, setNotes] = useState<OrderNote[]>([]);
  const [newNote, setNewNote] = useState<string>('');
  const [isCustomerNote, setIsCustomerNote] = useState<boolean>(false);
  const [loadingNotes, setLoadingNotes] = useState<boolean>(false);
  const [savingNote, setSavingNote] = useState<boolean>(false);
  const [deletingNoteId, setDeletingNoteId] = useState<number | null>(null);

  const fetchNotes = useCallback(async (): Promise<void> => {
    if (!activeStore || !order) return;

    try {
      const wc = new WooCommerceService(activeStore);
      const result = await wc.getOrderNotes(order.id);
      if (result.success) {
        setNotes(result.data);
      }
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Failed to fetch order notes:', err);
    } finally {
      setLoadingNotes(false);
    }
  }, [activeStore, order]);

  // Render-time adjustment: mark notes as loading as soon as the order we
  // need notes for changes (including on mount, via the NOT_SYNCED sentinel),
  // instead of synchronously inside the effect.
  // See https://react.dev/learn/you-might-not-need-an-effect
  const [prevOrderId, setPrevOrderId] = useState<number | undefined | typeof NOT_SYNCED>(NOT_SYNCED);
  if (prevOrderId !== order?.id) {
    setPrevOrderId(order?.id);
    if (order && activeStore) {
      setLoadingNotes(true);
    }
  }

  useEffect(() => {
    if (order && activeStore) {
      void Promise.resolve().then(() => fetchNotes());
    }
  }, [order, activeStore, fetchNotes]);

  const handleAddNote = async (e: FormEvent): Promise<void> => {
    e.preventDefault();
    if (!activeStore || !order || !newNote.trim() || savingNote) return;

    try {
      setSavingNote(true);
      const wc = new WooCommerceService(activeStore);
      const result = await wc.addOrderNote(order.id, newNote.trim(), isCustomerNote);
      if (result.success) {
        setNotes((prev) => [result.data, ...prev]);
        setNewNote('');
        showToast('Бележката е добавена', 'success');
      } else {
        showToast('Грешка при добавяне на бележка: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      showToast('Грешка: ' + (err as Error).message, 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleDeleteNote = async (noteId: number): Promise<void> => {
    if (!activeStore || !order || deletingNoteId) return;

    try {
      setDeletingNoteId(noteId);
      const wc = new WooCommerceService(activeStore);
      const result = await wc.deleteOrderNote(order.id, noteId);
      if (result.success) {
        setNotes((prev) => prev.filter((n) => n.id !== noteId));
        showToast('Бележката е изтрита', 'success');
      } else {
        showToast('Грешка при изтриване: ' + (result.error || 'Unknown error'), 'error');
      }
    } catch (err) {
      showToast('Грешка: ' + (err as Error).message, 'error');
    } finally {
      setDeletingNoteId(null);
    }
  };

  return {
    notes,
    newNote,
    isCustomerNote,
    loadingNotes,
    savingNote,
    deletingNoteId,
    setNewNote,
    setIsCustomerNote,
    handleAddNote,
    handleDeleteNote,
  };
}

export default useOrderNotes;
