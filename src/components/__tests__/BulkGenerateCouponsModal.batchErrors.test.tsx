import { vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import BulkGenerateCouponsModal from '../BulkGenerateCouponsModal';
import type WooCommerceService from '../../services/woocommerce';

describe('BulkGenerateCouponsModal', () => {
  it('counts per-item batch errors as failures and only passes real coupons', async () => {
    const batchCreateCoupons = vi.fn().mockResolvedValue({
      success: true,
      data: {
        create: [
          { id: 1, code: 'A' },
          { id: 0, error: { code: 'dup' } },
        ],
      },
    });
    const onGenerated = vi.fn();
    render(
      <BulkGenerateCouponsModal
        service={{ batchCreateCoupons } as unknown as WooCommerceService}
        onClose={vi.fn()}
        onGenerated={onGenerated}
      />
    );
    fireEvent.change(screen.getByLabelText(/Number of Coupons/), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText(/Amount/), { target: { value: '10' } });
    fireEvent.click(screen.getByRole('button', { name: /Generate 2 Coupons/ }));

    await waitFor(() => expect(screen.getByText('Generation Complete')).toBeInTheDocument());
    expect(screen.getByText(/Successfully created/).textContent).toContain('1');
    expect(screen.getByText(/Failed:/).textContent).toContain('1');
    expect(onGenerated).toHaveBeenCalledWith([{ id: 1, code: 'A' }]);
  });
});
