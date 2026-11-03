import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CustomerProfileExtras from '../CustomerProfileExtras';
import DuplicateCustomersModal from '../DuplicateCustomersModal';
import useCustomerNotes, { getCustomerNote } from '../../stores/customerNotesStore';
import { findDuplicateGroups } from '../../utils/customerProfile';
import useAppSettings from '../../stores/appSettingsStore';
import { createMockCustomer, createMockOrder } from '../../__test_utils__';

describe('CustomerProfileExtras', () => {
  beforeEach(() => useCustomerNotes.setState({ byStore: {} }));

  it('shows stats from cached orders and manages tags/notes', async () => {
    const user = userEvent.setup();
    const c = createMockCustomer({ id: 3, email: 'a@b.com' });
    const orders = [
      createMockOrder({ customer_id: 3, total: '10.00', status: 'completed' }),
      createMockOrder({ customer_id: 3, total: '20.00', status: 'completed' }),
      createMockOrder({ customer_id: 99, total: '500.00' }),
    ];
    render(<CustomerProfileExtras customer={c} storeId="s1" orders={orders} />);
    expect(screen.getByTestId('profile-orders')).toHaveTextContent('2');

    await user.type(screen.getByLabelText('New tag'), 'vip{Enter}');
    expect(screen.getByText('vip')).toBeInTheDocument();
    await user.type(screen.getByLabelText('Customer notes'), 'hi');
    const n = getCustomerNote(useCustomerNotes.getState().byStore, 's1', 3);
    expect(n).toMatchObject({ tags: ['vip'], notes: 'hi' });

    await user.click(screen.getByLabelText('Remove tag vip'));
    expect(screen.queryByText('vip')).not.toBeInTheDocument();
  });
});

describe('CustomerProfileExtras sync', () => {
  beforeEach(() => {
    useCustomerNotes.setState({ byStore: {} });
    useAppSettings.setState({ syncCustomerProfile: false });
  });

  it('adopts remote meta_data when sync is ON and remote is newer', () => {
    useAppSettings.setState({ syncCustomerProfile: true });
    const c = createMockCustomer({
      id: 3,
      meta_data: [
        { id: 1, key: '_storeos_tags', value: '["vip"]' },
        { id: 2, key: '_storeos_notes', value: 'remote' },
        { id: 3, key: '_storeos_updated', value: '1000' },
      ],
    });
    render(<CustomerProfileExtras customer={c} storeId="s1" orders={[]} />);
    expect(getCustomerNote(useCustomerNotes.getState().byStore, 's1', 3)).toMatchObject({
      tags: ['vip'],
      notes: 'remote',
    });
  });

  it('ignores remote meta_data when sync is OFF', () => {
    const c = createMockCustomer({
      id: 3,
      meta_data: [{ id: 3, key: '_storeos_updated', value: '1000' }],
    });
    render(<CustomerProfileExtras customer={c} storeId="s1" orders={[]} />);
    expect(getCustomerNote(useCustomerNotes.getState().byStore, 's1', 3).updatedAt).toBeUndefined();
  });
});

describe('DuplicateCustomersModal', () => {
  beforeEach(() => useCustomerNotes.setState({ byStore: {} }));

  it('marks non-primary members as duplicate without deleting', async () => {
    const user = userEvent.setup();
    const a = createMockCustomer({ id: 1, email: 'x@y.com', total_spent: '100', orders_count: 2 });
    const b = createMockCustomer({ id: 2, email: 'X@y.com', total_spent: '10', orders_count: 1 });
    render(
      <DuplicateCustomersModal
        groups={findDuplicateGroups([a, b])}
        storeId="s1"
        onClose={() => {}}
      />
    );
    expect(screen.getByTestId('duplicate-group')).toHaveTextContent('Combined: 3 orders');
    await user.click(screen.getByText('Mark as duplicate'));
    const { byStore } = useCustomerNotes.getState();
    expect(getCustomerNote(byStore, 's1', 2).tags).toEqual(['duplicate']);
    expect(getCustomerNote(byStore, 's1', 1).tags).toEqual([]);
  });
});
