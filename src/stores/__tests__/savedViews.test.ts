import { useSearch } from '../index';

describe('saved views (search store)', () => {
  beforeEach(() => {
    useSearch.setState({ savedFilterPresets: [] });
  });

  it('persists filters, search and page size, incl. customers', () => {
    const v = useSearch.getState().addFilterPreset({
      name: 'Big VIPs',
      type: 'customers',
      filters: {},
      search: 'vip',
      pageSize: 100,
      storeId: 's1',
    });
    expect(useSearch.getState().savedFilterPresets[0]).toMatchObject({
      id: v.id,
      type: 'customers',
      search: 'vip',
      pageSize: 100,
    });
  });

  it('omits empty extras so legacy-shaped presets stay unchanged', () => {
    const v = useSearch.getState().addFilterPreset({ name: 'Old', type: 'orders', filters: { a: 1 } });
    expect(v).not.toHaveProperty('pageSize');
    expect(v).not.toHaveProperty('search');
  });

  it('renames (trimmed) and ignores blank names', () => {
    const v = useSearch.getState().addFilterPreset({ name: 'A', type: 'orders' });
    useSearch.getState().renameFilterPreset(v.id, '  B  ');
    expect(useSearch.getState().savedFilterPresets[0]?.name).toBe('B');
    useSearch.getState().renameFilterPreset(v.id, '   ');
    expect(useSearch.getState().savedFilterPresets[0]?.name).toBe('B');
  });

  it('deletes a view', () => {
    const v = useSearch.getState().addFilterPreset({ name: 'A', type: 'products' });
    useSearch.getState().deleteFilterPreset(v.id);
    expect(useSearch.getState().savedFilterPresets).toHaveLength(0);
  });

  it('getSavedViews returns own-store and global views across types', () => {
    const s = useSearch.getState();
    s.addFilterPreset({ name: 'mine', type: 'orders', storeId: 's1' });
    s.addFilterPreset({ name: 'global', type: 'customers', storeId: 'all' });
    s.addFilterPreset({ name: 'other', type: 'products', storeId: 's2' });
    expect(useSearch.getState().getSavedViews('s1').map((p) => p.name)).toEqual(['mine', 'global']);
  });
});
