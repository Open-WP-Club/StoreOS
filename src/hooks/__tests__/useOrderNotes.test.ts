import { vi, Mock } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useOrderNotes } from '../useOrderNotes';
import { createMockStore, createMockOrder, createMockOrderNote } from '../../__test_utils__/mockFactories';
import type { WooCommerceStore, Order } from '../../types';
import WooCommerceService from '../../services/woocommerce';
import { useStoreConfig } from '../../stores';

// ============================================
// Mocks
// ============================================

vi.mock('../../services/woocommerce');
vi.mock('../../stores');

// ============================================
// Setup
// ============================================

let mockActiveStore: WooCommerceStore | undefined;
const mockShowToast = vi.fn();
const mockGetOrderNotes = vi.fn();
const mockAddOrderNote = vi.fn();
const mockDeleteOrderNote = vi.fn();
const mockOrder = createMockOrder({ id: 123 }) as Order;
const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

beforeEach(() => {
  mockActiveStore = createMockStore();

  (useStoreConfig as unknown as Mock).mockImplementation((selector?: (state: unknown) => unknown) => {
    const state = { getCurrentStore: () => mockActiveStore };
    return selector ? selector(state) : state;
  });

  (WooCommerceService as Mock).mockImplementation(function () { return {
    getOrderNotes: mockGetOrderNotes,
    addOrderNote: mockAddOrderNote,
    deleteOrderNote: mockDeleteOrderNote,
  }; });

  mockGetOrderNotes.mockResolvedValue({ success: true, data: [] });
});

afterAll(() => {
  consoleSpy.mockRestore();
});

// ============================================
// Tests
// ============================================

describe('useOrderNotes', () => {
  describe('fetching notes', () => {
    it('fetches notes when order and store are present', async () => {
      const notes = [createMockOrderNote({ id: 1, note: 'First note' })];
      mockGetOrderNotes.mockResolvedValue({ success: true, data: notes });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
        expect(result.current.notes[0]!.note).toBe('First note');
      });
    });

    it('does not fetch when order is null', () => {
      renderHook(() => useOrderNotes(null, mockShowToast));

      expect(mockGetOrderNotes).not.toHaveBeenCalled();
    });

    it('does not fetch when store is undefined', () => {
      mockActiveStore = undefined;

      renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      expect(mockGetOrderNotes).not.toHaveBeenCalled();
    });

    it('logs console error on fetch failure', async () => {
      mockGetOrderNotes.mockRejectedValue(new Error('Fetch failed'));

      renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith(
          'Failed to fetch order notes:',
          expect.any(Error)
        );
      });
    });

    it('sets loadingNotes during fetch', async () => {
      let resolvePromise: (value: unknown) => void;
      mockGetOrderNotes.mockReturnValue(
        new Promise((resolve) => { resolvePromise = resolve; })
      );

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.loadingNotes).toBe(true);
      });

      await act(async () => {
        resolvePromise!({ success: true, data: [] });
      });

      await waitFor(() => {
        expect(result.current.loadingNotes).toBe(false);
      });
    });
  });

  describe('handleAddNote', () => {
    const fakeEvent = { preventDefault: vi.fn() } as unknown as React.FormEvent;

    it('adds note and shows Bulgarian success toast', async () => {
      const newNote = createMockOrderNote({ id: 99, note: 'New note' });
      mockAddOrderNote.mockResolvedValue({ success: true, data: newNote });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.loadingNotes).toBe(false);
      });

      act(() => {
        result.current.setNewNote('New note');
      });

      await act(async () => {
        await result.current.handleAddNote(fakeEvent);
      });

      expect(fakeEvent.preventDefault).toHaveBeenCalled();
      expect(mockAddOrderNote).toHaveBeenCalledWith(123, 'New note', false);
      expect(mockShowToast).toHaveBeenCalledWith('Бележката е добавена', 'success');
      expect(result.current.newNote).toBe('');
    });

    it('prepends new note to notes array', async () => {
      const existingNote = createMockOrderNote({ id: 1, note: 'Old' });
      mockGetOrderNotes.mockResolvedValue({ success: true, data: [existingNote] });

      const newNote = createMockOrderNote({ id: 99, note: 'New' });
      mockAddOrderNote.mockResolvedValue({ success: true, data: newNote });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.setNewNote('New');
      });

      await act(async () => {
        await result.current.handleAddNote(fakeEvent);
      });

      expect(result.current.notes[0]!.id).toBe(99);
      expect(result.current.notes[1]!.id).toBe(1);
    });

    it('trims note before sending', async () => {
      mockAddOrderNote.mockResolvedValue({ success: true, data: createMockOrderNote() });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.loadingNotes).toBe(false);
      });

      act(() => {
        result.current.setNewNote('  Trimmed note  ');
      });

      await act(async () => {
        await result.current.handleAddNote(fakeEvent);
      });

      expect(mockAddOrderNote).toHaveBeenCalledWith(123, 'Trimmed note', false);
    });

    it('sends isCustomerNote flag', async () => {
      mockAddOrderNote.mockResolvedValue({ success: true, data: createMockOrderNote() });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.loadingNotes).toBe(false);
      });

      act(() => {
        result.current.setNewNote('Customer visible note');
        result.current.setIsCustomerNote(true);
      });

      await act(async () => {
        await result.current.handleAddNote(fakeEvent);
      });

      expect(mockAddOrderNote).toHaveBeenCalledWith(123, 'Customer visible note', true);
    });

    it('does not submit empty/whitespace note', async () => {
      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.loadingNotes).toBe(false);
      });

      act(() => {
        result.current.setNewNote('   ');
      });

      await act(async () => {
        await result.current.handleAddNote(fakeEvent);
      });

      expect(mockAddOrderNote).not.toHaveBeenCalled();
    });

    it('shows error toast on API failure', async () => {
      mockAddOrderNote.mockResolvedValue({ success: false, error: 'Permission denied' });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.loadingNotes).toBe(false);
      });

      act(() => {
        result.current.setNewNote('Note');
      });

      await act(async () => {
        await result.current.handleAddNote(fakeEvent);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Permission denied'),
        'error'
      );
    });

    it('shows error toast on exception', async () => {
      mockAddOrderNote.mockRejectedValue(new Error('Network error'));

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.loadingNotes).toBe(false);
      });

      act(() => {
        result.current.setNewNote('Note');
      });

      await act(async () => {
        await result.current.handleAddNote(fakeEvent);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Network error'),
        'error'
      );
    });

    it('resets savingNote flag after completion', async () => {
      mockAddOrderNote.mockResolvedValue({ success: true, data: createMockOrderNote() });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.loadingNotes).toBe(false);
      });

      act(() => {
        result.current.setNewNote('Note');
      });

      await act(async () => {
        await result.current.handleAddNote(fakeEvent);
      });

      expect(result.current.savingNote).toBe(false);
    });
  });

  describe('handleDeleteNote', () => {
    it('deletes note and shows Bulgarian success toast', async () => {
      const notes = [createMockOrderNote({ id: 5 }), createMockOrderNote({ id: 6 })];
      mockGetOrderNotes.mockResolvedValue({ success: true, data: notes });
      mockDeleteOrderNote.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(2);
      });

      await act(async () => {
        await result.current.handleDeleteNote(5);
      });

      expect(mockDeleteOrderNote).toHaveBeenCalledWith(123, 5);
      expect(result.current.notes).toHaveLength(1);
      expect(result.current.notes[0]!.id).toBe(6);
      expect(mockShowToast).toHaveBeenCalledWith('Бележката е изтрита', 'success');
    });

    it('does not delete when another note is being deleted', async () => {
      const notes = [createMockOrderNote({ id: 5 })];
      mockGetOrderNotes.mockResolvedValue({ success: true, data: notes });

      let resolveDelete: (value: unknown) => void;
      mockDeleteOrderNote.mockReturnValue(
        new Promise((resolve) => { resolveDelete = resolve; })
      );

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      act(() => {
        result.current.handleDeleteNote(5);
      });

      await act(async () => {
        await result.current.handleDeleteNote(6);
      });

      expect(mockDeleteOrderNote).toHaveBeenCalledTimes(1);

      await act(async () => {
        resolveDelete!({ success: true });
      });
    });

    it('shows error toast on API failure', async () => {
      mockGetOrderNotes.mockResolvedValue({ success: true, data: [createMockOrderNote({ id: 5 })] });
      mockDeleteOrderNote.mockResolvedValue({ success: false, error: 'Not found' });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      await act(async () => {
        await result.current.handleDeleteNote(5);
      });

      expect(mockShowToast).toHaveBeenCalledWith(
        expect.stringContaining('Not found'),
        'error'
      );
    });

    it('resets deletingNoteId after completion', async () => {
      mockGetOrderNotes.mockResolvedValue({ success: true, data: [createMockOrderNote({ id: 5 })] });
      mockDeleteOrderNote.mockResolvedValue({ success: true });

      const { result } = renderHook(() => useOrderNotes(mockOrder, mockShowToast));

      await waitFor(() => {
        expect(result.current.notes).toHaveLength(1);
      });

      await act(async () => {
        await result.current.handleDeleteNote(5);
      });

      expect(result.current.deletingNoteId).toBeNull();
    });
  });
});
