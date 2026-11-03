import { describe, it, expect, beforeEach } from 'vitest';
import useCustomerNotes, { getCustomerNote } from '../customerNotesStore';

describe('customerNotesStore', () => {
  beforeEach(() => useCustomerNotes.setState({ byStore: {} }));

  it('adds normalized, de-duplicated tags per store', () => {
    const { addTag } = useCustomerNotes.getState();
    addTag('s1', 1, ' VIP ');
    addTag('s1', 1, 'vip');
    addTag('s1', 1, '  ');
    addTag('s2', 1, 'late');
    const { byStore } = useCustomerNotes.getState();
    expect(getCustomerNote(byStore, 's1', 1).tags).toEqual(['vip']);
    expect(getCustomerNote(byStore, 's2', 1).tags).toEqual(['late']);
  });

  it('removes tags and sets notes', () => {
    const s = useCustomerNotes.getState();
    s.addTag('s1', 1, 'vip');
    s.setNotes('s1', 1, 'calls often');
    s.removeTag('s1', 1, 'vip');
    const n = getCustomerNote(useCustomerNotes.getState().byStore, 's1', 1);
    expect(n).toMatchObject({ tags: [], notes: 'calls often' });
  });

  it('returns empty note for unknown customer', () => {
    expect(getCustomerNote({}, 'x', 5)).toEqual({ tags: [], notes: '' });
  });
});

describe('customerNotesStore.mergeRemote', () => {
  beforeEach(() => useCustomerNotes.setState({ byStore: {} }));
  const get = (): ReturnType<typeof getCustomerNote> =>
    getCustomerNote(useCustomerNotes.getState().byStore, 's', 1);

  it('adopts newer remote', () => {
    useCustomerNotes.getState().mergeRemote('s', 1, { tags: ['a'], notes: 'r', updatedAt: 10 });
    expect(get()).toEqual({ tags: ['a'], notes: 'r', updatedAt: 10 });
  });

  it('keeps a newer local edit', () => {
    useCustomerNotes.getState().setNotes('s', 1, 'local');
    useCustomerNotes.getState().mergeRemote('s', 1, { tags: [], notes: 'old', updatedAt: 1 });
    expect(get().notes).toBe('local');
  });
});
