import React, { useState } from 'react';
import { ClipboardList } from 'lucide-react';
import { useStoreConfig, useCache } from '../stores';
import useSuppliers, { getStoreData, type PurchaseOrder } from '../stores/suppliersStore';
import { useStockUpdater } from '../hooks/useStockUpdater';
import { useToast } from '../hooks/useToast';
import { exportToCSV } from '../utils/csvExport';
import { exportTableToPDF } from '../utils/pdfExport';
import { poExportColumns, poExportRows, poTotal } from '../utils/purchaseOrders';
import { getCost } from '../utils/costPrice';
import ExportMenu from '../components/ExportMenu';
import PageHeader from '../components/PageHeader';
import EmptyState from '../components/EmptyState';
import ToastContainer from '../components/ToastContainer';
import { EMPTY_PRODUCTS } from '../constants';

const inputCls =
  'px-2 py-1 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-gray-900 dark:text-white rounded-md';
const btnCls =
  'px-3 py-1 rounded-md border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-700';
const primaryCls =
  'px-3 py-1 rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50';
const emptySupplier = { name: '', contact: '', email: '', phone: '', notes: '' };

const PurchaseOrdersPage: React.FC = (): React.ReactElement => {
  const currentStore = useStoreConfig((s) => s.getCurrentStore());
  const products = useCache((s) => s.cache.products?.data || EMPTY_PRODUCTS);
  const data = useSuppliers((s) => getStoreData(s.byStore, currentStore?.id ?? ''));
  const actions = useSuppliers((s) => s);
  const { toasts, showToast, removeToast } = useToast();
  const { applyStockCount, updateCost } = useStockUpdater({
    getProducts: () => useCache.getState().cache.products?.data ?? [],
    setProducts: () => undefined, // useStockUpdater already writes the cache
    showToast,
  });

  const [supplierForm, setSupplierForm] = useState(emptySupplier);
  const [newPoSupplier, setNewPoSupplier] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<number, string>>({});
  const [addProduct, setAddProduct] = useState('');

  if (!currentStore) {
    return <EmptyState title="No store selected" description="Select a store first." />;
  }
  const storeId = currentStore.id;
  const open = data.orders.find((o) => o.id === openId);
  const editable = open?.status === 'draft';

  const setLines = (o: PurchaseOrder, lines: PurchaseOrder['lines']): void =>
    actions.updateOrder(storeId, o.id, { lines });

  const handleReceive = async (o: PurchaseOrder): Promise<void> => {
    const qtys: Record<number, number> = {};
    for (const l of o.lines) {
      const q = Math.min(
        Math.floor(Number(receiveQty[l.productId] ?? l.qty - l.received) || 0),
        l.qty - l.received
      );
      if (q > 0) qtys[l.productId] = q;
    }
    const changes = Object.entries(qtys).flatMap(([id, q]) => {
      const p = products.find((x) => x.id === Number(id));
      return p?.manage_stock ? [{ productId: p.id, counted: (p.stock_quantity ?? 0) + q }] : [];
    });
    if (Object.keys(qtys).length === 0) return;
    // Same offline-aware path as Inventory > Receive stock.
    if (!(await applyStockCount(changes))) {
      showToast('Stock update failed; the purchase order was not marked as received', 'error');
      return;
    }
    // Keep the product cost current with what we actually paid
    for (const l of o.lines) {
      if (qtys[l.productId] && l.unitCost > 0) await updateCost(l.productId, l.unitCost);
    }
    actions.recordReceipt(storeId, o.id, qtys);
    setReceiveQty({});
    showToast('Stock received', 'success');
  };

  const handleCSV = (o: PurchaseOrder): void => {
    exportToCSV(poExportRows(o), poExportColumns, `PO-${o.number}.csv`);
  };
  const handlePDF = (o: PurchaseOrder): void => {
    exportTableToPDF(poExportRows(o), poExportColumns, {
      title: `Purchase order #${o.number} - ${o.supplierName}`,
      filename: `PO-${o.number}.pdf`,
    }).catch(() => undefined);
  };

  return (
    <div className="p-6 space-y-6">
      <ToastContainer toasts={toasts} removeToast={removeToast} />
      <PageHeader
        title="Purchase Orders"
        subtitle="Suppliers and purchase orders are stored locally on this device."
        icon={ClipboardList}
      />

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <h3 className="font-semibold text-gray-900 dark:text-white">Suppliers</h3>
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!supplierForm.name.trim()) return;
            actions.addSupplier(storeId, { ...supplierForm, name: supplierForm.name.trim() });
            setSupplierForm(emptySupplier);
          }}
        >
          {(['name', 'contact', 'email', 'phone', 'notes'] as const).map((k) => (
            <input
              key={k}
              aria-label={`Supplier ${k}`}
              placeholder={k[0]?.toUpperCase() + k.slice(1)}
              value={supplierForm[k]}
              onChange={(e) => setSupplierForm({ ...supplierForm, [k]: e.target.value })}
              className={inputCls}
            />
          ))}
          <button type="submit" className={primaryCls}>
            Add supplier
          </button>
        </form>
        <ul className="text-sm text-gray-900 dark:text-gray-100 divide-y divide-gray-100 dark:divide-gray-700">
          {data.suppliers.map((s) => (
            <li key={s.id} className="py-1 flex items-center gap-3">
              <span className="font-medium">{s.name}</span>
              <span className="text-gray-500 dark:text-gray-400">
                {[s.contact, s.email, s.phone].filter(Boolean).join(' · ')}
              </span>
              <button
                className="ml-auto text-red-600 dark:text-red-400"
                aria-label={`Delete supplier ${s.name}`}
                onClick={() => actions.removeSupplier(storeId, s.id)}
              >
                Delete
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3">
        <div className="flex items-center gap-2">
          <h3 className="font-semibold text-gray-900 dark:text-white">Orders</h3>
          <select
            aria-label="New order supplier"
            value={newPoSupplier}
            onChange={(e) => setNewPoSupplier(e.target.value)}
            className={`ml-auto ${inputCls}`}
          >
            <option value="">Unassigned</option>
            {data.suppliers.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            className={primaryCls}
            onClick={() => {
              const s = data.suppliers.find((x) => x.id === newPoSupplier);
              const o = actions.addOrder(storeId, {
                supplierId: s?.id ?? null,
                supplierName: s?.name ?? 'Unassigned',
                lines: [],
              });
              setOpenId(o.id);
            }}
          >
            New purchase order
          </button>
        </div>
        {data.orders.length === 0 ? (
          <p className="text-gray-500 dark:text-gray-400">
            No purchase orders yet. Create one here or from Inventory &gt; Reorder report.
          </p>
        ) : (
          <table className="w-full text-sm text-gray-900 dark:text-gray-100">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <th scope="col" className="py-2">
                  #
                </th>
                <th scope="col">Supplier</th>
                <th scope="col">Status</th>
                <th scope="col">Total</th>
                <th scope="col">Created</th>
                <th scope="col" />
              </tr>
            </thead>
            <tbody>
              {data.orders.map((o) => (
                <tr key={o.id} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2">PO-{o.number}</td>
                  <td>{o.supplierName}</td>
                  <td>{o.status}</td>
                  <td>{poTotal(o.lines).toFixed(2)}</td>
                  <td>{o.createdAt.slice(0, 10)}</td>
                  <td className="text-right">
                    <button
                      className={btnCls}
                      onClick={() => setOpenId(o.id === openId ? null : o.id)}
                    >
                      {o.id === openId ? 'Close' : 'Open'} PO-{o.number}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {open && (
        <section
          aria-label={`Purchase order ${open.number}`}
          className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 space-y-3"
        >
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-gray-900 dark:text-white">
              PO-{open.number} - {open.supplierName} ({open.status})
            </h3>
            <div className="ml-auto flex items-center gap-2">
              <ExportMenu
                onExportCSV={() => handleCSV(open)}
                onExportPDF={() => handlePDF(open)}
                disabled={open.lines.length === 0}
              />
              {open.status === 'draft' && (
                <button
                  className={primaryCls}
                  disabled={open.lines.length === 0}
                  onClick={() => actions.markOrdered(storeId, open.id)}
                >
                  Mark as ordered
                </button>
              )}
              <button
                className="text-red-600 dark:text-red-400"
                onClick={() => {
                  actions.removeOrder(storeId, open.id);
                  setOpenId(null);
                }}
              >
                Delete PO
              </button>
            </div>
          </div>
          <table className="w-full text-sm text-gray-900 dark:text-gray-100">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300 border-b border-gray-200 dark:border-gray-700">
                <th scope="col" className="py-2">
                  Product
                </th>
                <th scope="col">Qty</th>
                <th scope="col">Unit cost</th>
                <th scope="col">Received</th>
                {open.status !== 'draft' && open.status !== 'received' && (
                  <th scope="col">Receive now</th>
                )}
              </tr>
            </thead>
            <tbody>
              {open.lines.map((l, i) => (
                <tr key={l.productId} className="border-b border-gray-100 dark:border-gray-700">
                  <td className="py-2">{l.name}</td>
                  <td>
                    {editable ? (
                      <input
                        type="number"
                        min={1}
                        aria-label={`Quantity ${l.name}`}
                        className={`w-20 ${inputCls}`}
                        value={l.qty}
                        onChange={(e) =>
                          setLines(
                            open,
                            open.lines.map((x, j) =>
                              j === i
                                ? {
                                    ...x,
                                    qty: Math.max(1, Math.floor(Number(e.target.value) || 1)),
                                  }
                                : x
                            )
                          )
                        }
                      />
                    ) : (
                      l.qty
                    )}
                  </td>
                  <td>
                    {editable ? (
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        aria-label={`Unit cost ${l.name}`}
                        className={`w-24 ${inputCls}`}
                        value={l.unitCost}
                        onChange={(e) =>
                          setLines(
                            open,
                            open.lines.map((x, j) =>
                              j === i
                                ? { ...x, unitCost: Math.max(0, Number(e.target.value) || 0) }
                                : x
                            )
                          )
                        }
                      />
                    ) : (
                      l.unitCost.toFixed(2)
                    )}
                  </td>
                  <td>{l.received}</td>
                  {open.status !== 'draft' && open.status !== 'received' && (
                    <td>
                      <input
                        type="number"
                        min={0}
                        max={l.qty - l.received}
                        aria-label={`Receive ${l.name}`}
                        className={`w-20 ${inputCls}`}
                        value={receiveQty[l.productId] ?? String(l.qty - l.received)}
                        onChange={(e) =>
                          setReceiveQty({ ...receiveQty, [l.productId]: e.target.value })
                        }
                      />
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {editable && (
            <div className="flex gap-2">
              <select
                aria-label="Add product"
                value={addProduct}
                onChange={(e) => setAddProduct(e.target.value)}
                className={inputCls}
              >
                <option value="">Add product...</option>
                {products
                  .filter((p) => !open.lines.some((l) => l.productId === p.id))
                  .map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
              </select>
              <button
                className={btnCls}
                disabled={!addProduct}
                onClick={() => {
                  const p = products.find((x) => x.id === Number(addProduct));
                  if (!p) return;
                  setLines(open, [
                    ...open.lines,
                    {
                      productId: p.id,
                      name: p.name,
                      sku: p.sku,
                      qty: 1,
                      unitCost: getCost(p) ?? 0,
                      received: 0,
                    },
                  ]);
                  setAddProduct('');
                }}
              >
                Add line
              </button>
            </div>
          )}
          {(open.status === 'ordered' || open.status === 'partial') && (
            <button className={primaryCls} onClick={() => handleReceive(open)}>
              Receive stock
            </button>
          )}
          <p className="text-right font-medium text-gray-900 dark:text-white">
            Total: {poTotal(open.lines).toFixed(2)}
          </p>
        </section>
      )}
    </div>
  );
};

export default PurchaseOrdersPage;
