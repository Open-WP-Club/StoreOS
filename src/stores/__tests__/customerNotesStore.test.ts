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
    expect(n).toEqual({ tags: [], notes: 'calls often' });
  });

  it('returns empty note for unknown customer', () => {
    expect(getCustomerNote({}, 'x', 5)).toEqual({ tags: [], notes: '' });
  });
});
