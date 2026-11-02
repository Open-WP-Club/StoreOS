import useAppSettings from '../appSettingsStore';

describe('note templates', () => {
  beforeEach(() => useAppSettings.getState().resetAppSettings());

  it('adds, edits and deletes templates, ignoring blanks', () => {
    const s = useAppSettings.getState();
    s.addNoteTemplate('  Shipped  ');
    s.addNoteTemplate('   ');
    expect(useAppSettings.getState().noteTemplates).toHaveLength(1);
    const { id, text } = useAppSettings.getState().noteTemplates[0]!;
    expect(text).toBe('Shipped');
    s.updateNoteTemplate(id, 'Sent');
    expect(useAppSettings.getState().noteTemplates[0]!.text).toBe('Sent');
    s.deleteNoteTemplate(id);
    expect(useAppSettings.getState().noteTemplates).toEqual([]);
  });
});
