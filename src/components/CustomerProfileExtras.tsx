import { useState } from 'react';
import { formatPrice } from '../utils/currency';
import useCustomerNotes, { getCustomerNote } from '../stores/customerNotesStore';
import { customerOrderStats, ordersForCustomer } from '../utils/customerProfile';
import type { Customer, WooCommerceOrder } from '../types';

interface Props {
  customer: Customer;
  storeId: string;
  orders: WooCommerceOrder[];
}

const BOX = 'bg-gray-50 dark:bg-gray-700 rounded-lg p-3 text-center';
const LABEL = 'text-xs text-gray-500 dark:text-gray-400';

/** Tags, notes and cached-order lifetime stats shown inside the customer detail modal. */
function CustomerProfileExtras({ customer, storeId, orders }: Props): React.ReactElement {
  const note = useCustomerNotes((s) => getCustomerNote(s.byStore, storeId, customer.id));
  const addTag = useCustomerNotes((s) => s.addTag);
  const removeTag = useCustomerNotes((s) => s.removeTag);
  const setNotes = useCustomerNotes((s) => s.setNotes);
  const [tag, setTag] = useState('');
  const stats = customerOrderStats(ordersForCustomer(customer, orders));

  return (
    <div className="mb-6 space-y-4" data-testid="customer-profile-extras">
      <div className="grid grid-cols-4 gap-3 text-sm text-gray-900 dark:text-white">
        <div className={BOX}>
          <p className="font-bold" data-testid="profile-orders">
            {stats.count}
          </p>
          <p className={LABEL}>Cached orders</p>
        </div>
        <div className={BOX}>
          <p className="font-bold" data-testid="profile-ltv">
            {formatPrice(stats.lifetimeValue.toFixed(2))}
          </p>
          <p className={LABEL}>Lifetime value</p>
        </div>
        <div className={BOX}>
          <p className="font-bold">{formatPrice(stats.average.toFixed(2))}</p>
          <p className={LABEL}>Avg order</p>
        </div>
        <div className={BOX}>
          <p className="font-bold" data-testid="profile-last">
            {stats.lastOrderDate ? new Date(stats.lastOrderDate).toLocaleDateString() : 'N/A'}
          </p>
          <p className={LABEL}>Last order</p>
        </div>
      </div>

      <div>
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Tags (local)</h4>
        <div className="flex flex-wrap gap-2 mb-2">
          {note.tags.map((t) => (
            <span
              key={t}
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300"
            >
              {t}
              <button
                type="button"
                aria-label={`Remove tag ${t}`}
                onClick={() => removeTag(storeId, customer.id, t)}
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addTag(storeId, customer.id, tag);
            setTag('');
          }}
        >
          <input
            aria-label="New tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            placeholder="Add tag"
            className="flex-1 px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
          />
          <button
            type="submit"
            className="px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
          >
            Add
          </button>
        </form>
      </div>

      <div>
        <h4 className="font-semibold text-gray-900 dark:text-white mb-2">Notes (local)</h4>
        <textarea
          aria-label="Customer notes"
          value={note.notes}
          onChange={(e) => setNotes(storeId, customer.id, e.target.value)}
          rows={3}
          className="w-full px-2 py-1 text-sm border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md"
        />
      </div>
    </div>
  );
}

export default CustomerProfileExtras;
