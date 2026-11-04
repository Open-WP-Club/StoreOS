import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import LabelPrintModal from '../LabelPrintModal';
import type { Product } from '../../types';

describe('LabelPrintModal', () => {
  it('prints escaped labels via receipt IPC', async () => {
    const print = vi.fn().mockResolvedValue({ success: true });
    (window as unknown as { electronAPI: unknown }).electronAPI = { receipt: { print } };
    const onClose = vi.fn();
    const p = { id: 1, name: '<b>Tee</b>', sku: 'TEE1', price: '9.5' } as Product;
    render(
      <LabelPrintModal products={[p]} currencySymbol="$" onClose={onClose} showToast={vi.fn()} />
    );
    fireEvent.click(screen.getByText('Print'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const html = print.mock.calls[0]![0].html as string;
    expect(html).toContain('&lt;b&gt;Tee');
    expect(html).toContain('<svg');
    delete (window as unknown as { electronAPI?: unknown }).electronAPI;
  });
});
