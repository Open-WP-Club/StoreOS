import { useState, useCallback, ReactElement } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { FileText, ClipboardList } from 'lucide-react';
import { useStoreConfig } from '../stores';
import { getOrderStatusColor } from '../constants';
import { exportOrderInvoice, exportPackingSlip } from '../utils/pdfExport';
import { useOrderDetail } from '../hooks/useOrderDetail';
import { useOrderNotes } from '../hooks/useOrderNotes';
import type { OrderLineItem } from '../types';
import ToastContainer from '../components/ToastContainer';
import PluginMetaPanel from '../components/PluginMetaPanel';
import WpAdminModal from '../components/WpAdminModal';
import ImageLightbox from '../components/ImageLightbox';
import OrderItemsTable from '../components/OrderItemsTable';
import OrderNotesSection from '../components/OrderNotesSection';
import OrderSidebar from '../components/OrderSidebar';

function OrderDetailPage(): ReactElement {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const getCurrentStore = useStoreConfig((state) => state.getCurrentStore);
  const activeStore = getCurrentStore();

  const {
    order,
    loading,
    refreshing,
    error,
    updatingStatus,
    handleStatusUpdate,
    fetchOrderFromApi,
    showToast,
    toasts,
    removeToast,
  } = useOrderDetail(id);

  const notesHook = useOrderNotes(order, showToast);

  const [wpAdminUrl, setWpAdminUrl] = useState<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [lightboxIndex, setLightboxIndex] = useState<number>(0);

  // Get images from line items for lightbox
  const itemImages = (order?.line_items || [])
    .filter((item: OrderLineItem) => item.image?.src)
    .map((item: OrderLineItem) => ({
      src: item.image!.src,
      name: item.name,
    }));

  const openLightbox = (itemIndex: number): void => {
    const imageIndex = itemImages.findIndex(
      (img) => img.name === order?.line_items[itemIndex]?.name
    );
    if (imageIndex >= 0) {
      setLightboxIndex(imageIndex);
      setLightboxOpen(true);
    }
  };

  const handleOpenWpAdmin = useCallback((url: string): void => {
    setWpAdminUrl(url);
  }, []);

  const handleCloseWpAdmin = useCallback((): void => {
    setWpAdminUrl(null);
    fetchOrderFromApi(false);
  }, [fetchOrderFromApi]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading order...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div>
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 rounded-lg p-4">
          <p className="text-red-800 dark:text-red-400">Error: {error}</p>
          <button
            onClick={() => navigate('/orders')}
            className="mt-4 text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-300 font-medium"
          >
            ← Back to Orders
          </button>
        </div>
      </div>
    );
  }

  if (!order) {
    return (
      <div>
        <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <p className="text-yellow-800 dark:text-yellow-400">Order not found</p>
          <button
            onClick={() => navigate('/orders')}
            className="mt-4 text-yellow-600 dark:text-yellow-400 hover:text-yellow-800 dark:hover:text-yellow-300 font-medium"
          >
            ← Back to Orders
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <Link
          to="/orders"
          className="text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium mb-4 inline-block"
        >
          ← Back to Orders
        </Link>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Order #{order.id}
            </h1>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Placed on {new Date(order.date_created).toLocaleString()}
            </p>
          </div>
          <div className="mt-4 sm:mt-0 flex items-center space-x-4">
            {refreshing && (
              <span className="text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1">
                <span className="animate-spin h-3 w-3 border-2 border-blue-500 border-t-transparent rounded-full"></span>
                Syncing...
              </span>
            )}
            <button
              onClick={() =>
                exportOrderInvoice(order, activeStore?.name || 'Store', order.currency || 'USD')
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Export Invoice PDF"
            >
              <FileText className="w-4 h-4" />
              Invoice
            </button>
            <button
              onClick={() =>
                exportPackingSlip(order, activeStore?.name || 'Store')
              }
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white dark:bg-gray-700 border border-gray-300 dark:border-gray-600 rounded-lg text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-600 transition-colors"
              title="Export Packing Slip PDF"
            >
              <ClipboardList className="w-4 h-4" />
              Packing Slip
            </button>
            <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getOrderStatusColor(order.status)}`}>
              {(order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1)}
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Content */}
        <div className="lg:col-span-2 space-y-6">
          <OrderItemsTable order={order} onOpenLightbox={openLightbox} />

          {/* Customer Note (from checkout) */}
          {order.customer_note && (
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg overflow-hidden transition-colors">
              <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-700">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Бележка от клиента</h2>
              </div>
              <div className="px-6 py-4">
                <p className="text-sm text-gray-700 dark:text-gray-300">{order.customer_note}</p>
              </div>
            </div>
          )}

          <OrderNotesSection
            notes={notesHook.notes}
            newNote={notesHook.newNote}
            isCustomerNote={notesHook.isCustomerNote}
            loadingNotes={notesHook.loadingNotes}
            savingNote={notesHook.savingNote}
            deletingNoteId={notesHook.deletingNoteId}
            onNewNoteChange={notesHook.setNewNote}
            onIsCustomerNoteChange={notesHook.setIsCustomerNote}
            onAddNote={notesHook.handleAddNote}
            onDeleteNote={notesHook.handleDeleteNote}
          />

          <PluginMetaPanel
            orderMeta={order.meta_data || []}
            shippingLines={order.shipping_lines || []}
            orderId={order.id}
            storeUrl={activeStore?.url}
            onOpenWpAdmin={handleOpenWpAdmin}
          />
        </div>

        {/* Right Column - Sidebar */}
        <OrderSidebar
          order={order}
          updatingStatus={updatingStatus}
          onStatusUpdate={handleStatusUpdate}
        />
      </div>

      <ToastContainer toasts={toasts} removeToast={removeToast} />

      <WpAdminModal
        isOpen={wpAdminUrl !== null}
        url={wpAdminUrl || ''}
        title={`Поръчка #${order.id} - WP Admin`}
        onClose={handleCloseWpAdmin}
      />

      {lightboxOpen && itemImages.length > 0 && (
        <ImageLightbox
          images={itemImages}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
}

export default OrderDetailPage;
