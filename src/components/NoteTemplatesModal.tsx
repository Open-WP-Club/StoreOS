import { ReactElement, useState } from 'react';
import { Plus, Trash2, Check } from 'lucide-react';
import Modal from './TitledModal';
import useAppSettings from '../stores/appSettingsStore';

const inputCls =
  'flex-1 px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded text-sm';

/** Add / edit / delete canned note templates. */
export default function NoteTemplatesModal({ onClose }: { onClose: () => void }): ReactElement {
  const templates = useAppSettings((s) => s.noteTemplates);
  const add = useAppSettings((s) => s.addNoteTemplate);
  const update = useAppSettings((s) => s.updateNoteTemplate);
  const remove = useAppSettings((s) => s.deleteNoteTemplate);
  const [draft, setDraft] = useState('');
  const [edits, setEdits] = useState<Record<string, string>>({});

  return (
    <Modal title="Шаблони за бележки" onClose={onClose}>
      <div className="space-y-2 max-h-72 overflow-y-auto">
        {templates.length === 0 && (
          <p className="text-sm text-gray-500 dark:text-gray-400">Няма шаблони</p>
        )}
        {templates.map((t) => {
          const val = edits[t.id] ?? t.text;
          return (
            <div key={t.id} className="flex items-center gap-2">
              <input
                aria-label="Шаблон"
                className={inputCls}
                value={val}
                onChange={(e) => setEdits({ ...edits, [t.id]: e.target.value })}
              />
              {val !== t.text && (
                <button
                  aria-label="Запази шаблона"
                  onClick={() => {
                    update(t.id, val);
                    setEdits(({ [t.id]: _drop, ...rest }) => rest);
                  }}
                  className="p-1 text-green-600 dark:text-green-400"
                >
                  <Check className="w-4 h-4" />
                </button>
              )}
              <button
                aria-label="Изтрий шаблона"
                onClick={() => remove(t.id)}
                className="p-1 text-gray-400 hover:text-red-500"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
      <form
        className="flex items-center gap-2 mt-4"
        onSubmit={(e) => {
          e.preventDefault();
          add(draft);
          setDraft('');
        }}
      >
        <input
          aria-label="Нов шаблон"
          className={inputCls}
          placeholder="Нов шаблон..."
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          aria-label="Добави шаблон"
          className="p-1.5 bg-blue-600 text-white rounded disabled:opacity-50"
        >
          <Plus className="w-4 h-4" />
        </button>
      </form>
    </Modal>
  );
}
