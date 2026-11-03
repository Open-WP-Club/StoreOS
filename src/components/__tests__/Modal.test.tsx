import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import Modal from '../Modal';

const setup = (props = {}) => {
  const onClose = vi.fn();
  render(
    <Modal onClose={onClose} className="panel" aria-label="Test" {...props}>
      <button>inside</button>
    </Modal>
  );
  return onClose;
};

describe('Modal', () => {
  it('renders an accessible dialog', () => {
    setup();
    expect(screen.getByRole('dialog', { name: 'Test' })).toHaveAttribute('aria-modal', 'true');
  });

  it('closes on Escape', () => {
    const onClose = setup();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('does not close on Escape when disabled', () => {
    const onClose = setup({ closeOnEscape: false });
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes on backdrop click but not panel click', () => {
    const onClose = setup();
    fireEvent.click(screen.getByText('inside'));
    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores backdrop click when disabled', () => {
    const onClose = setup({ closeOnBackdrop: false });
    fireEvent.click(screen.getByRole('dialog').parentElement!);
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe('Modal focus management', () => {
  const Wrapper = ({ open }: { open: boolean }) => (
    <div>
      <button>opener</button>
      {open && (
        <Modal onClose={() => {}} aria-label="Focus">
          <button>first</button>
          <button>last</button>
        </Modal>
      )}
    </div>
  );

  it('moves focus into the dialog on open', () => {
    render(<Wrapper open />);
    expect(screen.getByRole('dialog')).toHaveFocus();
  });

  it('cycles Tab from last to first and Shift+Tab from first to last', () => {
    render(<Wrapper open />);
    const dialog = screen.getByRole('dialog');
    screen.getByText('last').focus();
    fireEvent.keyDown(dialog, { key: 'Tab' });
    expect(screen.getByText('first')).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true });
    expect(screen.getByText('last')).toHaveFocus();
  });

  it('restores focus to the opener on close', () => {
    const { rerender } = render(<Wrapper open={false} />);
    screen.getByText('opener').focus();
    rerender(<Wrapper open />);
    expect(screen.getByRole('dialog')).toHaveFocus();
    rerender(<Wrapper open={false} />);
    expect(screen.getByText('opener')).toHaveFocus();
  });
});
