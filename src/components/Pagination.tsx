import React from 'react';

interface PaginationProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange: (size: number) => void;
  pageSizeOptions?: number[];
}

type PageNumber = number | 'start-ellipsis' | 'end-ellipsis';

/**
 * Accessible Pagination Component
 *
 * Features:
 * - Full ARIA support for screen readers
 * - Keyboard navigation
 * - Page size selector
 * - Responsive design with dark mode
 */
const Pagination: React.FC<PaginationProps> = ({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  pageSizeOptions = [25, 50, 100, 200],
}) => {
  const totalPages = Math.ceil(totalItems / pageSize);
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  const getPageNumbers = (): PageNumber[] => {
    const pages: PageNumber[] = [];
    const maxPagesToShow = 5;

    if (totalPages <= maxPagesToShow) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      pages.push(1);

      let startPage = Math.max(2, currentPage - 1);
      let endPage = Math.min(totalPages - 1, currentPage + 1);

      if (currentPage <= 3) {
        endPage = Math.min(4, totalPages - 1);
      }

      if (currentPage >= totalPages - 2) {
        startPage = Math.max(2, totalPages - 3);
      }

      if (startPage > 2) {
        pages.push('start-ellipsis');
      }

      for (let i = startPage; i <= endPage; i++) {
        pages.push(i);
      }

      if (endPage < totalPages - 1) {
        pages.push('end-ellipsis');
      }

      pages.push(totalPages);
    }

    return pages;
  };

  if (totalPages <= 1 && totalItems <= pageSize) {
    return (
      <div className="mt-6 flex items-center justify-center border-t border-gray-200 dark:border-gray-700 pt-4 px-4">
        <div className="text-sm text-gray-700 dark:text-gray-300">
          Showing <span className="font-medium">{startItem}</span> to{' '}
          <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{totalItems}</span> results
        </div>
      </div>
    );
  }

  return (
    <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-200 dark:border-gray-700 pt-4">
      <div className="flex items-center gap-4">
        <div
          className="text-sm text-gray-700 dark:text-gray-300"
          aria-live="polite"
          aria-atomic="true"
        >
          Showing <span className="font-medium">{startItem}</span> to{' '}
          <span className="font-medium">{endItem}</span> of{' '}
          <span className="font-medium">{totalItems}</span> results
        </div>

        <div className="flex items-center gap-2">
          <label
            htmlFor="pagination-page-size"
            className="text-sm text-gray-700 dark:text-gray-300"
          >
            Per page:
          </label>
          <select
            id="pagination-page-size"
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="rounded-md border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white py-1 px-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {pageSizeOptions.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </div>
      </div>

      <nav className="flex items-center gap-1" aria-label="Pagination navigation" role="navigation">
        <button
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage === 1}
          aria-label="Go to previous page"
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
            currentPage === 1
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Previous
        </button>

        <div className="flex items-center gap-1" role="list">
          {getPageNumbers().map((page) => {
            if (page === 'start-ellipsis' || page === 'end-ellipsis') {
              return (
                <span
                  key={page}
                  className="px-3 py-1 text-gray-500 dark:text-gray-400"
                  aria-hidden="true"
                >
                  &hellip;
                </span>
              );
            }

            const isCurrentPage = currentPage === page;

            return (
              <button
                key={page}
                onClick={() => onPageChange(page)}
                aria-label={`Go to page ${page}`}
                aria-current={isCurrentPage ? 'page' : undefined}
                className={`min-w-[2.25rem] px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
                  isCurrentPage
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
              >
                {page}
              </button>
            );
          })}
        </div>

        <button
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          aria-label="Go to next page"
          className={`px-3 py-1 rounded-md text-sm font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 dark:focus:ring-offset-gray-800 ${
            currentPage === totalPages
              ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
              : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
          }`}
        >
          Next
        </button>
      </nav>
    </div>
  );
};

export default Pagination;
