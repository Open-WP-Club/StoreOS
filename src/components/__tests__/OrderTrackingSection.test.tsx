import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import OrderTrackingSection from '../OrderTrackingSection';
import { createMockOrder } from '../../__test_utils__/mockFactories';
import { TRACKING_META_KEY } from '../../utils/tracking';

const updateOrder = vi.fn();
const addOrderNote = vi.fn();
let store: unknown = {
  id: 's1',
  url: 'https://shop.test',
  consumerKey: 'ck_test',
  consumerSecret: 'cs_test',
};

vi.mock('../../stores', () => ({
  useStoreConfig: (sel: (s: unknown) => unknown) => sel({ getCurrentStore: () => store }),
}));
vi.mock('../../services/woocommerce', () => ({
  default: class {
    updateOrder = (...a: unknown[]) => updateOrder(...a);
    addOrderNote = (...a: unknown[]) => addOrderNote(...a);
  },
}));

const fill = (num: string, carrier = ''): void => {
  fireEvent.change(screen.getByLabelText('Номер за проследяване'), { target: { value: num } });
  fireEvent.change(screen.getByLabelText('Куриер'), { target: { value: carrier } });
};
const submit = (): void => {
  fireEvent.click(screen.getByRole('button', { name: /Запази и уведоми/ }));
};

describe('OrderTrackingSection', () => {
  const showToast = vi.fn();
  const onSaved = vi.fn();
  beforeEach(() => {
    store = {
      id: 's1',
      url: 'https://shop.test',
      consumerKey: 'ck_test',
      consumerSecret: 'cs_test',
    };
    updateOrder.mockResolvedValue({ success: true, data: {} });
    addOrderNote.mockResolvedValue({ success: true, data: {} });
  });

  it('disables submit until a number is entered', () => {
    render(
      <OrderTrackingSection order={createMockOrder()} showToast={showToast} onSaved={onSaved} />
    );
    expect(screen.getByRole('button', { name: /Запази и уведоми/ })).toBeDisabled();
    fill('  ');
    expect(screen.getByRole('button', { name: /Запази и уведоми/ })).toBeDisabled();
  });

  it('prefills from existing tracking meta', () => {
    const order = createMockOrder({
      meta_data: [{ id: 5, key: TRACKING_META_KEY, value: { number: 'AB1', carrier: 'Speedy' } }],
    });
    render(<OrderTrackingSection order={order} showToast={showToast} onSaved={onSaved} />);
    expect((screen.getByLabelText('Номер за проследяване') as HTMLInputElement).value).toBe('AB1');
    expect((screen.getByLabelText('Куриер') as HTMLInputElement).value).toBe('Speedy');
  });

  it('saves meta then a customer note and calls onSaved', async () => {
    render(
      <OrderTrackingSection
        order={createMockOrder({ id: 42 })}
        showToast={showToast}
        onSaved={onSaved}
      />
    );
    fill(' 123 ', ' Speedy ');
    submit();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    const [id, payload] = updateOrder.mock.calls[0]!;
    expect(id).toBe(42);
    expect(JSON.stringify(payload)).toContain('"number":"123"');
    expect(addOrderNote).toHaveBeenCalledWith(42, expect.stringContaining('123'), true);
    expect(showToast).toHaveBeenCalledWith('Проследяването е записано', 'success');
  });

  it('reports update failure and skips the note', async () => {
    updateOrder.mockResolvedValue({ success: false, error: 'nope' });
    render(
      <OrderTrackingSection order={createMockOrder()} showToast={showToast} onSaved={onSaved} />
    );
    fill('1');
    submit();
    await waitFor(() =>
      expect(showToast).toHaveBeenCalledWith(expect.stringContaining('nope'), 'error')
    );
    expect(addOrderNote).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });

  it('warns when the note fails but still refreshes', async () => {
    addOrderNote.mockResolvedValue({ success: false, error: 'x' });
    render(
      <OrderTrackingSection order={createMockOrder()} showToast={showToast} onSaved={onSaved} />
    );
    fill('1');
    submit();
    await waitFor(() => expect(onSaved).toHaveBeenCalled());
    expect(showToast).toHaveBeenCalledWith('Записано, но бележката не е добавена', 'error');
  });

  it('toasts on a thrown error', async () => {
    updateOrder.mockRejectedValue(new Error('boom'));
    render(
      <OrderTrackingSection order={createMockOrder()} showToast={showToast} onSaved={onSaved} />
    );
    fill('1');
    submit();
    await waitFor(() => expect(showToast).toHaveBeenCalledWith('Грешка: boom', 'error'));
  });

  it('does nothing without a store', () => {
    store = null;
    render(
      <OrderTrackingSection order={createMockOrder()} showToast={showToast} onSaved={onSaved} />
    );
    fill('1');
    submit();
    expect(updateOrder).not.toHaveBeenCalled();
  });
});
