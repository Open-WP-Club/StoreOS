import Modal from './Modal';
import { formatPrice } from '../utils/currency';
import useCustomerNotes from '../stores/customerNotesStore';
import { DUPLICATE_TAG, type DuplicateGroup } from '../utils/customerProfile';

interface Props {
  groups: DuplicateGroup[];
  storeId: string;
  onClose: () => void;
}

const spent = (c: { total_spent?: string }): number => parseFloat(c.total_spent || '0');

/** Review probable duplicates. REST can't merge customers, so we only tag them (nothing is deleted). */
function DuplicateCustomersModal({ groups, storeId, onClose }: Props): React.ReactElement {
  const addTag = useCustomerNotes((s) => s.addTag);

  return (
    <Modal
      onClose={onClose}
      title="Possible duplicate customers"
      className="mx-4 bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6"
    >
      {groups.length === 0 && (
        <p className="text-sm text-gray-500 dark:text-gray-400">No duplicates found.</p>
      )}
      {groups.map((g) => {
        // Primary = highest spender; the rest get the local "duplicate" tag.
        const sorted = [...g.customers].sort((a, b) => spent(b) - spent(a));
        const orders = g.customers.reduce((s, c) => s + (c.orders_count || 0), 0);
        const total = g.customers.reduce((s, c) => s + spent(c), 0);
        return (
          <div
            key={g.customers.map((c) => c.id).join('-')}
            data-testid="duplicate-group"
            className="mb-4 p-3 border border-gray-200 dark:border-gray-700 rounded-lg"
          >
            <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">
              Matched by {g.reasons.join(', ')}
            </p>
            <ul className="text-sm text-gray-900 dark:text-white space-y-1">
              {sorted.map((c, i) => (
                <li key={c.id}>
                  #{c.id} {c.first_name} {c.last_name} · {c.email} · {c.orders_count || 0} orders ·{' '}
                  {formatPrice(c.total_spent || '0')}
                  {i === 0 && ' (primary)'}
                </li>
              ))}
            </ul>
            <p className="text-sm font-medium text-gray-900 dark:text-white mt-2">
              Combined: {orders} orders · {formatPrice(total.toFixed(2))}
            </p>
            <button
              type="button"
              onClick={() => sorted.slice(1).forEach((c) => addTag(storeId, c.id, DUPLICATE_TAG))}
              className="mt-2 px-3 py-1 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Mark as duplicate
            </button>
          </div>
        );
      })}
    </Modal>
  );
}

export default DuplicateCustomersModal;
