import { vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { OrderNotesSection } from '../OrderNotesSection';
import { createMockOrderNote } from '../../__test_utils__/mockFactories';

const defaultProps = {
  notes: [],
  newNote: '',
  isCustomerNote: false,
  loadingNotes: false,
  savingNote: false,
  deletingNoteId: null,
  onNewNoteChange: vi.fn(),
  onIsCustomerNoteChange: vi.fn(),
  onAddNote: vi.fn((e) => { e.preventDefault(); return Promise.resolve(); }),
  onDeleteNote: vi.fn(() => Promise.resolve()),
};

function renderSection(overrides = {}) {
  const props = { ...defaultProps, ...overrides };
  return render(<OrderNotesSection {...props} />);
}

describe('OrderNotesSection', () => {
  it('renders header', () => {
    renderSection();
    expect(screen.getByText('Бележки')).toBeInTheDocument();
  });

  it('shows "Няма бележки" when empty and not loading', () => {
    renderSection({ notes: [], loadingNotes: false });
    expect(screen.getByText('Няма бележки')).toBeInTheDocument();
  });

  it('does not show empty message when loading', () => {
    renderSection({ notes: [], loadingNotes: true });
    expect(screen.queryByText('Няма бележки')).not.toBeInTheDocument();
  });

  it('renders notes list', () => {
    const notes = [
      createMockOrderNote({ id: 1, note: 'First note', author: 'Admin' }),
      createMockOrderNote({ id: 2, note: 'Second note', author: 'System' }),
    ];
    renderSection({ notes });
    expect(screen.getByText('First note')).toBeInTheDocument();
    expect(screen.getByText('Second note')).toBeInTheDocument();
    expect(screen.getByText('Admin')).toBeInTheDocument();
    expect(screen.getByText('System')).toBeInTheDocument();
  });

  it('shows customer note badge for customer-visible notes', () => {
    const notes = [createMockOrderNote({ id: 1, customer_note: true })];
    renderSection({ notes });
    // "Видима за клиента" appears in both the checkbox label and the note badge
    const matches = screen.getAllByText('Видима за клиента');
    // Expect at least 2: one in the form checkbox, one in the note badge
    expect(matches.length).toBeGreaterThanOrEqual(2);
  });

  it('does not show customer note badge for private notes', () => {
    const notes = [createMockOrderNote({ id: 1, customer_note: false })];
    renderSection({ notes });
    // Only the checkbox label should have this text, not a badge
    const matches = screen.getAllByText('Видима за клиента');
    expect(matches).toHaveLength(1); // Only the checkbox label
  });

  it('calls onNewNoteChange when textarea changes', () => {
    const onNewNoteChange = vi.fn();
    renderSection({ onNewNoteChange });
    fireEvent.change(screen.getByPlaceholderText('Добави бележка...'), {
      target: { value: 'New content' },
    });
    expect(onNewNoteChange).toHaveBeenCalledWith('New content');
  });

  it('calls onIsCustomerNoteChange when checkbox changes', () => {
    const onIsCustomerNoteChange = vi.fn();
    renderSection({ onIsCustomerNoteChange });
    fireEvent.click(screen.getByLabelText('Видима за клиента'));
    expect(onIsCustomerNoteChange).toHaveBeenCalledWith(true);
  });

  it('submit button disabled when newNote is empty', () => {
    renderSection({ newNote: '' });
    expect(screen.getByText('Добави').closest('button')).toBeDisabled();
  });

  it('submit button disabled when saving', () => {
    renderSection({ newNote: 'Some note', savingNote: true });
    expect(screen.getByText('Добави').closest('button')).toBeDisabled();
  });

  it('submit button enabled with content', () => {
    renderSection({ newNote: 'Some note', savingNote: false });
    expect(screen.getByText('Добави').closest('button')).not.toBeDisabled();
  });

  it('calls onAddNote on form submit', () => {
    const onAddNote = vi.fn((e) => { e.preventDefault(); return Promise.resolve(); });
    renderSection({ newNote: 'Note text', onAddNote });
    fireEvent.submit(screen.getByText('Добави').closest('form')!);
    expect(onAddNote).toHaveBeenCalled();
  });

  it('calls onDeleteNote with correct ID', () => {
    const onDeleteNote = vi.fn(() => Promise.resolve());
    const notes = [createMockOrderNote({ id: 42, note: 'Delete me' })];
    renderSection({ notes, onDeleteNote });
    fireEvent.click(screen.getByTitle('Изтрий бележката'));
    expect(onDeleteNote).toHaveBeenCalledWith(42);
  });

  it('disables delete button for note being deleted', () => {
    const notes = [createMockOrderNote({ id: 42 })];
    renderSection({ notes, deletingNoteId: 42 });
    expect(screen.getByTitle('Изтрий бележката')).toBeDisabled();
  });

  it('does not disable delete button for other notes', () => {
    const notes = [
      createMockOrderNote({ id: 42 }),
      createMockOrderNote({ id: 43 }),
    ];
    renderSection({ notes, deletingNoteId: 42 });
    const buttons = screen.getAllByTitle('Изтрий бележката');
    expect(buttons[0]).toBeDisabled();
    expect(buttons[1]).not.toBeDisabled();
  });
});
