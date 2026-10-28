import React, { useEffect, useState, useMemo, ChangeEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useStoreConfig } from '../stores';
import WooCommerceService from '../services/woocommerce';
import { exportToCSV } from '../utils/csvExport';
import { exportTableToPDF } from '../utils/pdfExport';
import ExportMenu from '../components/ExportMenu';
import Pagination from '../components/Pagination';
import ToastContainer from '../components/ToastContainer';
import LoadingIndicator from '../components/LoadingIndicator';
import { useToast } from '../hooks/useToast';
import { useProgressiveLoading } from '../hooks/useProgressiveLoading';
import {
  RefreshCw,
  Search,
  Star,
  Trash2,
  CheckCircle,
  Clock,
  AlertTriangle,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Eye,
  Shield,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import type { WooCommerceReview } from '../types';
import StatCard from '../components/StatCard';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ConfirmDialog from '../components/ConfirmDialog';

interface ReviewStats {
  total: number;
  approved: number;
  pending: number;
  spam: number;
  averageRating: number;
  verified: number;
  fiveStar: number;
  oneStar: number;
}

type FilterStatus = 'all' | 'approved' | 'hold' | 'spam' | 'trash';
type FilterRating = 'all' | '1' | '2' | '3' | '4' | '5';
type SortBy = 'date' | 'rating_high' | 'rating_low';

function ReviewsPage(): React.ReactElement {
  const [searchParams, setSearchParams] = useSearchParams();
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const currentStore = getCurrentStore();
  const { toasts, showToast, removeToast } = useToast();

  const [reviews, setReviews] = useState<WooCommerceReview[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>(searchParams.get('search') || '');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [filterRating, setFilterRating] = useState<FilterRating>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [expandedReview, setExpandedReview] = useState<number | null>(null);
  const [actionLoading, setActionLoading] = useState<number | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    isOpen: boolean;
    reviewId: number | null;
  }>({
    isOpen: false,
    reviewId: null,
  });

  const { loadingState } = useProgressiveLoading();

  // Load reviews from API
  useEffect(() => {
    const loadReviews = async (): Promise<void> => {
      if (!currentStore) return;

      setLoading(true);
      try {
        const service = new WooCommerceService(currentStore);
        const result = await service.getAllReviews({ per_page: 50 });

        if (result.success) {
          setReviews(result.data);
        } else {
          showToast(result.error || 'Failed to load reviews', 'error');
        }
      } catch (err) {
        showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
      } finally {
        setLoading(false);
      }
    };

    loadReviews();
  }, [currentStore, showToast]);

  // Memoized stats
  const stats = useMemo<ReviewStats>(() => {
    const total = reviews.length;
    const approved = reviews.filter((r) => r.status === 'approved').length;
    const pending = reviews.filter((r) => r.status === 'hold').length;
    const spam = reviews.filter((r) => r.status === 'spam').length;
    const verified = reviews.filter((r) => r.verified).length;
    const fiveStar = reviews.filter((r) => r.rating === 5).length;
    const oneStar = reviews.filter((r) => r.rating === 1).length;

    const totalRating = reviews.reduce((sum, r) => sum + r.rating, 0);
    const averageRating = total > 0 ? Math.round((totalRating / total) * 10) / 10 : 0;

    return {
      total,
      approved,
      pending,
      spam,
      averageRating,
      verified,
      fiveStar,
      oneStar,
    };
  }, [reviews]);

  // Filter and sort reviews
  const filteredReviews = useMemo(() => {
    let result = reviews;

    // Apply status filter
    if (filterStatus !== 'all') {
      result = result.filter((r) => r.status === filterStatus);
    }

    // Apply rating filter
    if (filterRating !== 'all') {
      result = result.filter((r) => r.rating === parseInt(filterRating));
    }

    // Apply search
    if (searchTerm.trim() !== '') {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (r) =>
          r.reviewer?.toLowerCase().includes(term) ||
          r.reviewer_email?.toLowerCase().includes(term) ||
          r.review?.toLowerCase().includes(term) ||
          r.product_name?.toLowerCase().includes(term) ||
          r.product_id?.toString().includes(term)
      );
    }

    // Apply sort
    if (sortBy === 'rating_high') {
      result = [...result].sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'rating_low') {
      result = [...result].sort((a, b) => a.rating - b.rating);
    }

    return result;
  }, [reviews, searchTerm, filterStatus, filterRating, sortBy]);

  // Pagination
  const paginatedReviews = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize;
    return filteredReviews.slice(startIndex, startIndex + pageSize);
  }, [filteredReviews, currentPage, pageSize]);

  // Reset page on filter change (render-time adjustment, see
  // https://react.dev/learn/you-might-not-need-an-effect#adjusting-some-state-when-a-prop-changes)
  const filterKey = `${searchTerm}|${filterStatus}|${filterRating}|${sortBy}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (prevFilterKey !== filterKey) {
    setPrevFilterKey(filterKey);
    setCurrentPage(1);
  }

  const handleRefresh = async (): Promise<void> => {
    if (!currentStore) return;

    setLoading(true);
    try {
      const service = new WooCommerceService(currentStore);
      const result = await service.getAllReviews({ per_page: 50 });

      if (result.success) {
        setReviews(result.data);
        showToast('Reviews refreshed', 'success');
      } else {
        showToast(result.error || 'Failed to refresh reviews', 'error');
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusChange = async (
    reviewId: number,
    newStatus: 'approved' | 'hold' | 'spam' | 'trash'
  ): Promise<void> => {
    if (!currentStore) return;

    setActionLoading(reviewId);
    try {
      const service = new WooCommerceService(currentStore);
      const result = await service.updateReview(reviewId, {
        status: newStatus,
      });

      if (result.success) {
        setReviews((prev) => prev.map((r) => (r.id === reviewId ? result.data : r)));
        const statusLabels: Record<string, string> = {
          approved: 'approved',
          hold: 'set to pending',
          spam: 'marked as spam',
          trash: 'trashed',
        };
        showToast(`Review ${statusLabels[newStatus]}`, 'success');
      } else {
        showToast(result.error || 'Failed to update review', 'error');
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setActionLoading(null);
    }
  };

  const handleBulkApprove = async (): Promise<void> => {
    if (!currentStore) return;

    const pendingReviews = reviews.filter((r) => r.status === 'hold');
    if (pendingReviews.length === 0) {
      showToast('No pending reviews to approve', 'info');
      return;
    }

    setLoading(true);
    try {
      const service = new WooCommerceService(currentStore);
      const updates = pendingReviews.map((r) => ({
        id: r.id,
        status: 'approved' as const,
      }));
      const result = await service.batchUpdateReviews(updates);

      if (result.success) {
        setReviews((prev) =>
          prev.map((r) => (r.status === 'hold' ? { ...r, status: 'approved' as const } : r))
        );
        showToast(`${pendingReviews.length} reviews approved`, 'success');
      } else {
        showToast(result.error || 'Failed to approve reviews', 'error');
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteReview = async (reviewId: number): Promise<void> => {
    if (!currentStore) return;

    setActionLoading(reviewId);
    try {
      const service = new WooCommerceService(currentStore);
      const result = await service.deleteReview(reviewId);

      if (result.success) {
        setReviews((prev) => prev.filter((r) => r.id !== reviewId));
        showToast('Review deleted permanently', 'success');
      } else {
        showToast(result.error || 'Failed to delete review', 'error');
      }
    } catch (err) {
      showToast(`Error: ${err instanceof Error ? err.message : 'Unknown error'}`, 'error');
    } finally {
      setActionLoading(null);
      setDeleteConfirm({ isOpen: false, reviewId: null });
    }
  };

  const handleExportCSV = (): void => {
    if (!currentStore) return;

    const columns = [
      { key: 'id', label: 'Review ID' },
      { key: 'product_name', label: 'Product' },
      { key: 'reviewer', label: 'Reviewer' },
      { key: 'reviewer_email', label: 'Email' },
      { key: 'rating', label: 'Rating' },
      { key: 'status', label: 'Status' },
      { key: 'verified', label: 'Verified' },
      { key: 'date_created', label: 'Date' },
      { key: 'review', label: 'Review Text' },
    ];

    const filename = `reviews-${currentStore.name}-${new Date().toISOString().split('T')[0]}.csv`;
    exportToCSV(
      filteredReviews.map((r) => ({
        ...r,
        review: r.review.replace(/<[^>]*>/g, ''),
      })),
      columns,
      filename
    );
  };

  const handleExportPDF = (): void => {
    if (!currentStore) return;

    const columns = [
      { key: 'product_name', label: 'Product' },
      { key: 'reviewer', label: 'Reviewer' },
      { key: 'rating', label: 'Rating' },
      { key: 'status', label: 'Status' },
      { key: 'date_created', label: 'Date' },
    ];

    exportTableToPDF(filteredReviews, columns, {
      title: `Reviews - ${currentStore.name}`,
    }).catch(() => showToast('PDF export failed', 'error'));
  };

  const handlePageChange = (page: number): void => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePageSizeChange = (newPageSize: number): void => {
    setPageSize(newPageSize);
    setCurrentPage(1);
  };

  const renderStars = (rating: number, size: 'sm' | 'md' = 'sm'): React.ReactElement => {
    const sizeClass = size === 'sm' ? 'w-4 h-4' : 'w-5 h-5';
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`${sizeClass} ${
              star <= rating
                ? 'text-yellow-400 fill-yellow-400'
                : 'text-gray-300 dark:text-gray-600'
            }`}
          />
        ))}
      </div>
    );
  };

  const getStatusBadge = (status: string): React.ReactElement => {
    const styles: Record<string, string> = {
      approved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      hold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      spam: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      trash: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400',
    };
    const labels: Record<string, string> = {
      approved: 'Approved',
      hold: 'Pending',
      spam: 'Spam',
      trash: 'Trashed',
    };

    return (
      <span
        className={`px-2 py-1 text-xs font-semibold rounded-full ${styles[status] || styles.hold}`}
      >
        {labels[status] || status}
      </span>
    );
  };

  const stripHtml = (html: string): string => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    return doc.body.textContent || '';
  };

  if (!currentStore) {
    return <EmptyState title="No store selected" message="Please select a store to view reviews" />;
  }

  return (
    <div>
      <LoadingIndicator loadingState={loadingState} />
      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <PageHeader title="Reviews" subtitle="Manage product reviews and ratings" />

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <StatCard label="Total Reviews" value={stats.total} icon={MessageSquare} />
        <StatCard label="Approved" value={stats.approved} color="green" icon={CheckCircle} />
        <StatCard label="Pending" value={stats.pending} color="yellow" icon={Clock} />
        <StatCard
          label="Avg Rating"
          value={stats.averageRating > 0 ? `${stats.averageRating} / 5` : '-'}
          color="blue"
          icon={Star}
        />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <StatCard label="Verified" value={stats.verified} color="purple" icon={Shield} />
        <StatCard label="5 Stars" value={stats.fiveStar} color="green" icon={ThumbsUp} />
        <StatCard label="1 Star" value={stats.oneStar} color="red" icon={ThumbsDown} />
        <StatCard label="Spam" value={stats.spam} color="red" icon={AlertTriangle} />
      </div>

      {/* Search and Actions */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-4 mb-6 transition-colors">
        <div className="flex flex-wrap gap-4">
          <div className="flex-1 min-w-[200px] relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by reviewer, email, product, or content..."
              value={searchTerm}
              onChange={(e: ChangeEvent<HTMLInputElement>) => {
                const value = e.target.value;
                setSearchTerm(value);
                if (value.trim() !== '') {
                  setSearchParams({ search: value });
                } else {
                  setSearchParams({});
                }
              }}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="approved">Approved</option>
            <option value="hold">Pending</option>
            <option value="spam">Spam</option>
            <option value="trash">Trashed</option>
          </select>
          <select
            value={filterRating}
            onChange={(e) => setFilterRating(e.target.value as FilterRating)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="all">All Ratings</option>
            <option value="5">5 Stars</option>
            <option value="4">4 Stars</option>
            <option value="3">3 Stars</option>
            <option value="2">2 Stars</option>
            <option value="1">1 Star</option>
          </select>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md focus:ring-blue-500 focus:border-blue-500"
          >
            <option value="date">Newest First</option>
            <option value="rating_high">Highest Rating</option>
            <option value="rating_low">Lowest Rating</option>
          </select>
          {stats.pending > 0 && (
            <button
              onClick={handleBulkApprove}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
              title={`Approve all ${stats.pending} pending reviews`}
            >
              <CheckCircle className="w-4 h-4" />
              Approve All ({stats.pending})
            </button>
          )}
          <ExportMenu onExportCSV={handleExportCSV} onExportPDF={handleExportPDF} />
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
            title="Refresh reviews"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Results Summary */}
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing{' '}
          <span className="font-semibold text-gray-900 dark:text-white">
            {filteredReviews.length}
          </span>{' '}
          of <span className="font-semibold text-gray-900 dark:text-white">{reviews.length}</span>{' '}
          reviews
        </div>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading reviews...</p>
        </div>
      ) : (
        <div className="space-y-4">
          {paginatedReviews.length === 0 ? (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-8 text-center text-gray-500 dark:text-gray-400">
              No reviews found
            </div>
          ) : (
            paginatedReviews.map((review) => {
              const isExpanded = expandedReview === review.id;
              const isActionLoading = actionLoading === review.id;
              const reviewText = stripHtml(review.review);

              return (
                <div
                  key={review.id}
                  className={`bg-white dark:bg-gray-800 rounded-lg shadow-md overflow-hidden transition-colors ${
                    review.status === 'hold'
                      ? 'border-l-4 border-yellow-400'
                      : review.status === 'spam'
                        ? 'border-l-4 border-red-400'
                        : review.status === 'trash'
                          ? 'border-l-4 border-gray-400 opacity-60'
                          : ''
                  }`}
                >
                  <div className="p-4">
                    {/* Header */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-1">
                          <span className="font-semibold text-gray-900 dark:text-white">
                            {review.reviewer}
                          </span>
                          {review.verified && (
                            <span className="flex items-center gap-1 px-2 py-0.5 text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 rounded-full">
                              <Shield className="w-3 h-3" />
                              Verified
                            </span>
                          )}
                          {getStatusBadge(review.status)}
                        </div>
                        <div className="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400">
                          <span>{review.reviewer_email}</span>
                          <span>|</span>
                          <span>{new Date(review.date_created).toLocaleDateString()}</span>
                          {review.product_name && (
                            <>
                              <span>|</span>
                              <span className="text-blue-600 dark:text-blue-400 truncate max-w-xs">
                                {review.product_name}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3 flex-shrink-0">
                        {renderStars(review.rating, 'md')}
                        <button
                          onClick={() => setExpandedReview(isExpanded ? null : review.id)}
                          className="p-1 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5" />
                          ) : (
                            <ChevronDown className="w-5 h-5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Review Text Preview */}
                    <div className="mt-3">
                      <p
                        className={`text-gray-700 dark:text-gray-300 text-sm ${
                          !isExpanded ? 'line-clamp-2' : ''
                        }`}
                      >
                        {reviewText}
                      </p>
                    </div>

                    {/* Expanded Actions */}
                    {isExpanded && (
                      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                          {review.status !== 'approved' && (
                            <button
                              onClick={() => handleStatusChange(review.id, 'approved')}
                              disabled={isActionLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors disabled:opacity-50"
                            >
                              <CheckCircle className="w-4 h-4" />
                              Approve
                            </button>
                          )}
                          {review.status !== 'hold' && review.status !== 'approved' && (
                            <button
                              onClick={() => handleStatusChange(review.id, 'hold')}
                              disabled={isActionLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50"
                            >
                              <Clock className="w-4 h-4" />
                              Set Pending
                            </button>
                          )}
                          {review.status === 'approved' && (
                            <button
                              onClick={() => handleStatusChange(review.id, 'hold')}
                              disabled={isActionLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-yellow-600 text-white rounded-md hover:bg-yellow-700 transition-colors disabled:opacity-50"
                            >
                              <Clock className="w-4 h-4" />
                              Unapprove
                            </button>
                          )}
                          {review.status !== 'spam' && (
                            <button
                              onClick={() => handleStatusChange(review.id, 'spam')}
                              disabled={isActionLoading}
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-orange-600 text-white rounded-md hover:bg-orange-700 transition-colors disabled:opacity-50"
                            >
                              <AlertTriangle className="w-4 h-4" />
                              Mark Spam
                            </button>
                          )}
                          <button
                            onClick={() =>
                              setDeleteConfirm({
                                isOpen: true,
                                reviewId: review.id,
                              })
                            }
                            disabled={isActionLoading}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:opacity-50"
                          >
                            <Trash2 className="w-4 h-4" />
                            Delete
                          </button>
                          {review.product_permalink && (
                            <a
                              href={review.product_permalink}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-md hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
                            >
                              <Eye className="w-4 h-4" />
                              View Product
                            </a>
                          )}
                        </div>

                        {/* Review Details */}
                        <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Review ID:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              #{review.id}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Product ID:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              #{review.product_id}
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Rating:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {review.rating}/5
                            </span>
                          </div>
                          <div>
                            <span className="text-gray-500 dark:text-gray-400">Verified:</span>
                            <span className="ml-2 font-medium text-gray-900 dark:text-white">
                              {review.verified ? 'Yes' : 'No'}
                            </span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}

          {filteredReviews.length > 0 && (
            <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-2">
              <Pagination
                currentPage={currentPage}
                totalItems={filteredReviews.length}
                pageSize={pageSize}
                onPageChange={handlePageChange}
                onPageSizeChange={handlePageSizeChange}
              />
            </div>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={deleteConfirm.isOpen}
        title="Delete Review"
        message="Are you sure you want to permanently delete this review? This action cannot be undone."
        variant="danger"
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteConfirm.reviewId) {
            handleDeleteReview(deleteConfirm.reviewId);
          }
        }}
        onCancel={() => setDeleteConfirm({ isOpen: false, reviewId: null })}
        isLoading={actionLoading !== null}
      />
    </div>
  );
}

export default ReviewsPage;
