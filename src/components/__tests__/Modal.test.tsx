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
