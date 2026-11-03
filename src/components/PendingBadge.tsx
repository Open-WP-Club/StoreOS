import React from 'react';

/** Marks an item created offline that has not synced yet. */
function PendingBadge(): React.ReactElement {
  return (
    <span className="ml-2 inline-block rounded px-1.5 py-0.5 text-xs font-medium bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400">
      Pending sync
    </span>
  );
}

export default PendingBadge;
