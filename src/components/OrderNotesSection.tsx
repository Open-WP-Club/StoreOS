import { ReactElement, FormEvent } from 'react';
import { MessageSquare, Send, Trash2, Loader2 } from 'lucide-react';
import type { OrderNote } from '../types';

interface OrderNotesSectionProps {
  notes: OrderNote[];
  newNote: string;
  isCustomerNote: boolean;
  loadingNotes: boolean;
  savingNote: boolean;
  deletingNoteId: number | null;
  onNewNoteChange: (note: string) => void;
  onIsCustomerNoteChange: (value: boolean) => void;
  onAddNote: (e: FormEvent) => Promise<void>;
  onDeleteNote: (noteId: number) => Promise<void>;
}

/**
 * Order notes section: add note form + notes list.
 */
export function OrderNotesSection({
  notes,
  newNote,
  isCustomerNote,
  loadingNotes,
  savingNote,
  deletingNoteId,
  onNewNoteChange,
  onIsCustomerNoteChange,
  onAddNote,
  onDeleteNote,
}: OrderNotesSectionProps): ReactElement {
  return (
    <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden transition-colors">
      <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
          <MessageSquare className="w-5 h-5" />
          Бележки
        </h2>
        {loadingNotes && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
      </div>
      <div className="px-6 py-4 space-y-4">
        {/* Add new note form */}
        <form onSubmit={onAddNote} className="space-y-3">
          <textarea
            value={newNote}
            onChange={(e) => onNewNoteChange(e.target.value)}
            placeholder="Добави бележка..."
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-lg text-sm focus:ring-blue-500 focus:border-blue-500 resize-none"
            rows={3}
          />
          <div className="flex items-center justify-between">
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={isCustomerNote}
                onChange={(e) => onIsCustomerNoteChange(e.target.checked)}
                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
              />
              Видима за клиента
            </label>
            <button
              type="submit"
              disabled={!newNote.trim() || savingNote}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {savingNote ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Добави
            </button>
          </div>
        </form>

        {/* Notes list */}
        {notes.length > 0 ? (
          <div className="space-y-3 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            {notes.map((note) => (
              <div
                key={note.id}
                className={`p-3 rounded-lg ${
                  note.customer_note
                    ? 'bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-800'
                    : 'bg-gray-50 dark:bg-gray-700'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <p className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {note.note}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400">
                      <span>{note.author}</span>
                      <span>•</span>
                      <span>{new Date(note.date_created).toLocaleString('bg-BG')}</span>
                      {note.customer_note && (
                        <>
                          <span>•</span>
                          <span className="text-blue-600 dark:text-blue-400">Видима за клиента</span>
                        </>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => onDeleteNote(note.id)}
                    disabled={deletingNoteId === note.id}
                    className="p-1 text-gray-400 hover:text-red-500 transition-colors"
                    title="Изтрий бележката"
                  >
                    {deletingNoteId === note.id ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : !loadingNotes ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-2">
            Няма бележки
          </p>
        ) : null}
      </div>
    </div>
  );
}

export default OrderNotesSection;
