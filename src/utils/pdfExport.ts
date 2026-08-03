/**
 * Utility functions for exporting data to PDF format
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { WooCommerceOrder, OrderLineItem } from '../types';
import { formatCurrency } from './currency';

// ============================================
// Types
// ============================================

export interface PDFColumn<T = unknown> {
  key: string;
  label: string;
  format?: (value: unknown, item: T) => string;
  width?: number;
}

export interface TablePDFOptions {
  title?: string;
  filename?: string;
  orientation?: 'portrait' | 'landscape';
}

// ============================================
// Invoice Export
// ============================================

/**
 * Export an order as a formatted invoice PDF
 */
export function exportOrderInvoice(
  order: WooCommerceOrder,
  storeName: string = 'Store',
  currencyCode: string = 'USD'
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('INVOICE', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(storeName, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Order info bar
  doc.setFillColor(245, 245, 245);
  doc.rect(14, y - 5, pageWidth - 28, 18, 'F');

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.text(`Order #${order.number || order.id}`, 20, y + 3);

  doc.setFont('helvetica', 'normal');
  const dateStr = new Date(order.date_created).toLocaleDateString();
  doc.text(`Date: ${dateStr}`, pageWidth / 2, y + 3, { align: 'center' });

  const statusLabel = (order.status || 'pending').charAt(0).toUpperCase() + (order.status || 'pending').slice(1);
  doc.text(`Status: ${statusLabel}`, pageWidth - 20, y + 3, { align: 'right' });
  y += 22;

  // Billing & Shipping addresses
  const colWidth = (pageWidth - 28) / 2;

  // Billing
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40);
  doc.text('Bill To', 14, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  y += 5;
  const billing = order.billing;
  const billingLines = [
    [billing.first_name, billing.last_name].filter(Boolean).join(' '),
    billing.company,
    billing.address_1,
    billing.address_2,
    [billing.city, billing.state, billing.postcode].filter(Boolean).join(', '),
    billing.country,
    billing.email,
    billing.phone,
  ].filter(Boolean);

  billingLines.forEach((line) => {
    doc.text(line, 14, y);
    y += 4;
  });

  // Shipping
  const shipping = order.shipping;
  const hasShipping = shipping?.address_1 || shipping?.first_name;
  if (hasShipping) {
    let sy = y - (billingLines.length * 4); // Same starting Y as billing
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40);
    doc.text('Ship To', 14 + colWidth + 10, sy - 5);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    const shippingLines = [
      [shipping.first_name, shipping.last_name].filter(Boolean).join(' '),
      shipping.company,
      shipping.address_1,
      shipping.address_2,
      [shipping.city, shipping.state, shipping.postcode].filter(Boolean).join(', '),
      shipping.country,
    ].filter(Boolean);

    shippingLines.forEach((line) => {
      doc.text(line, 14 + colWidth + 10, sy);
      sy += 4;
    });
  }

  y += 5;

  // Line items table
  const formatAmount = (amount: string | number): string => {
    return formatCurrency(amount, currencyCode);
  };

  const tableBody = (order.line_items || []).map((item: OrderLineItem) => [
    item.name,
    item.sku || '-',
    String(item.quantity),
    formatAmount(item.price),
    formatAmount(item.total),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Product', 'SKU', 'Qty', 'Price', 'Total']],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 8.5,
      textColor: [60, 60, 60],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 30 },
      2: { cellWidth: 15, halign: 'center' },
      3: { cellWidth: 30, halign: 'right' },
      4: { cellWidth: 30, halign: 'right' },
    },
    margin: { left: 14, right: 14 },
  });

  // Get final Y position after table
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // Totals section
  const totalsX = pageWidth - 80;
  const valuesX = pageWidth - 14;
  doc.setFontSize(9);
  doc.setTextColor(80);

  const subtotal = (order.line_items || []).reduce(
    (sum: number, item: OrderLineItem) => sum + parseFloat(item.subtotal || item.total),
    0
  );
  doc.text('Subtotal:', totalsX, y);
  doc.text(formatAmount(subtotal), valuesX, y, { align: 'right' });
  y += 5;

  if (order.discount_total && parseFloat(order.discount_total) > 0) {
    doc.text('Discount:', totalsX, y);
    doc.text(`-${formatAmount(order.discount_total)}`, valuesX, y, { align: 'right' });
    y += 5;
  }

  if (order.shipping_total && parseFloat(order.shipping_total) > 0) {
    const shippingLabel = order.shipping_lines?.[0]?.method_title
      ? `Shipping (${order.shipping_lines[0].method_title}):`
      : 'Shipping:';
    doc.text(shippingLabel, totalsX, y);
    doc.text(formatAmount(order.shipping_total), valuesX, y, { align: 'right' });
    y += 5;
  }

  if (order.total_tax && parseFloat(order.total_tax) > 0) {
    doc.text('Tax:', totalsX, y);
    doc.text(formatAmount(order.total_tax), valuesX, y, { align: 'right' });
    y += 5;
  }

  // Total line
  y += 2;
  doc.setDrawColor(200);
  doc.line(totalsX, y - 2, valuesX, y - 2);

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40);
  doc.text('Total:', totalsX, y + 3);
  doc.text(formatAmount(order.total), valuesX, y + 3, { align: 'right' });
  y += 12;

  // Payment info
  if (order.payment_method_title) {
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(120);
    doc.text(`Payment: ${order.payment_method_title}`, 14, y);
    if (order.transaction_id) {
      doc.text(`Transaction: ${order.transaction_id}`, 14, y + 4);
    }
  }

  // Save
  const filename = `invoice-${order.number || order.id}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

// ============================================
// Packing Slip Export
// ============================================

/**
 * Export an order as a packing slip PDF (no prices, focused on items and shipping)
 */
export function exportPackingSlip(
  order: WooCommerceOrder,
  storeName: string = 'Store'
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Header
  doc.setFontSize(22);
  doc.setFont('helvetica', 'bold');
  doc.text('PACKING SLIP', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(100);
  doc.text(storeName, pageWidth / 2, y, { align: 'center' });
  y += 15;

  // Order info bar
  doc.setFillColor(245, 245, 245);
  doc.rect(14, y - 5, pageWidth - 28, 12, 'F');

  doc.setFontSize(10);
  doc.setTextColor(60);
  doc.setFont('helvetica', 'bold');
  doc.text(`Order #${order.number || order.id}`, 20, y + 3);

  doc.setFont('helvetica', 'normal');
  const dateStr = new Date(order.date_created).toLocaleDateString();
  doc.text(`Date: ${dateStr}`, pageWidth - 20, y + 3, { align: 'right' });
  y += 18;

  // Shipping address (primary focus for packing slip)
  const shipping = order.shipping;
  const hasShipping = shipping?.address_1 || shipping?.first_name;
  const addressSource = hasShipping ? shipping : order.billing;
  const addressLabel = hasShipping ? 'Ship To' : 'Deliver To';

  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40);
  doc.text(addressLabel, 14, y);

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80);
  y += 5;

  const addressLines = [
    [addressSource.first_name, addressSource.last_name].filter(Boolean).join(' '),
    addressSource.company,
    addressSource.address_1,
    addressSource.address_2,
    [addressSource.city, addressSource.state, addressSource.postcode].filter(Boolean).join(', '),
    addressSource.country,
  ].filter(Boolean);

  addressLines.forEach((line) => {
    doc.text(line, 14, y);
    y += 4.5;
  });

  // Shipping method
  if (order.shipping_lines?.length > 0) {
    y += 3;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60);
    const firstShippingLine = order.shipping_lines[0];
    doc.text(`Shipping: ${firstShippingLine?.method_title ?? ''}`, 14, y);
  }

  y += 8;

  // Items table (no prices — just product, SKU, quantity)
  const tableBody = (order.line_items || []).map((item: OrderLineItem) => [
    item.name,
    item.sku || '-',
    String(item.quantity),
  ]);

  autoTable(doc, {
    startY: y,
    head: [['Product', 'SKU', 'Qty']],
    body: tableBody,
    theme: 'striped',
    headStyles: {
      fillColor: [75, 85, 99],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 9,
    },
    bodyStyles: {
      fontSize: 9,
      textColor: [60, 60, 60],
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 40 },
      2: { cellWidth: 25, halign: 'center' },
    },
    margin: { left: 14, right: 14 },
  });

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  y = (doc as any).lastAutoTable.finalY + 10;

  // Total items count
  const totalItems = (order.line_items || []).reduce(
    (sum: number, item: OrderLineItem) => sum + item.quantity,
    0
  );
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40);
  doc.text(`Total Items: ${totalItems}`, 14, y);

  // Customer note
  if (order.customer_note) {
    y += 10;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(60);
    doc.text('Customer Note:', 14, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(80);
    const noteLines = doc.splitTextToSize(order.customer_note, pageWidth - 28);
    doc.text(noteLines, 14, y);
  }

  // Save
  const filename = `packing-slip-${order.number || order.id}-${new Date().toISOString().split('T')[0]}.pdf`;
  doc.save(filename);
}

// ============================================
// Report Export (with summary metrics)
// ============================================

export interface ReportSummaryMetric {
  label: string;
  value: string;
}

export interface ReportPDFOptions {
  title?: string;
  storeName?: string;
  timeRange?: string;
  filename?: string;
  orientation?: 'portrait' | 'landscape';
}

/**
 * Export a report PDF with title, summary metrics, and data table
 */
export function exportReportToPDF<T extends object>(
  data: T[],
  columns: PDFColumn<T>[],
  summaryMetrics: ReportSummaryMetric[],
  options: ReportPDFOptions = {}
): void {
  const {
    title = 'Report',
    storeName,
    timeRange,
    filename,
    orientation = 'portrait',
  } = options;

  const doc = new jsPDF({ orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  // Title
  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, y, { align: 'center' });
  y += 8;

  // Store name
  if (storeName) {
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(storeName, pageWidth / 2, y, { align: 'center' });
    y += 5;
  }

  // Time range + generation date
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  const meta = [
    timeRange ? `Period: ${timeRange}` : null,
    `Generated: ${new Date().toLocaleString()}`,
  ].filter(Boolean).join('  |  ');
  doc.text(meta, pageWidth / 2, y, { align: 'center' });
  y += 10;

  // Summary metrics (2-column layout)
  if (summaryMetrics.length > 0) {
    doc.setFillColor(245, 245, 245);
    const metricsPerCol = Math.ceil(summaryMetrics.length / 2);
    const blockHeight = metricsPerCol * 7 + 6;
    doc.rect(14, y - 3, pageWidth - 28, blockHeight, 'F');

    const colWidth = (pageWidth - 28) / 2;

    summaryMetrics.forEach((metric, i) => {
      const col = i < metricsPerCol ? 0 : 1;
      const row = i < metricsPerCol ? i : i - metricsPerCol;
      const x = 20 + col * colWidth;
      const my = y + 3 + row * 7;

      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(60);
      doc.text(`${metric.label}:`, x, my);

      doc.setFont('helvetica', 'normal');
      doc.setTextColor(40);
      doc.text(metric.value, x + 60, my);
    });

    y += blockHeight + 5;
  }

  // Data table
  if (data && data.length > 0) {
    const headers = columns.map((col) => col.label);
    const body = data.map((item) =>
      columns.map((col) => {
        const value = col.key.split('.').reduce(
          (obj: Record<string, unknown> | undefined, key: string) =>
            obj?.[key] as Record<string, unknown> | undefined,
          item as Record<string, unknown>
        );
        if (col.format) {
          return col.format(value, item);
        }
        return value == null ? '' : String(value);
      })
    );

    autoTable(doc, {
      startY: y,
      head: [headers],
      body,
      theme: 'striped',
      headStyles: {
        fillColor: [59, 130, 246],
        textColor: 255,
        fontStyle: 'bold',
        fontSize: 8,
      },
      bodyStyles: {
        fontSize: 7.5,
        textColor: [60, 60, 60],
      },
      margin: { left: 14, right: 14 },
    });
  }

  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `${title.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.pdf`;
  doc.save(finalFilename);
}

// ============================================
// Generic Table Export
// ============================================

/**
 * Export tabular data as a PDF (for analytics and reports)
 */
export function exportTableToPDF<T extends object>(
  data: T[],
  columns: PDFColumn<T>[],
  options: TablePDFOptions = {}
): void {
  const {
    title = 'Report',
    filename,
    orientation = 'portrait',
  } = options;

  if (!data || data.length === 0) return;

  const doc = new jsPDF({ orientation });
  const pageWidth = doc.internal.pageSize.getWidth();

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(title, pageWidth / 2, 20, { align: 'center' });

  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(120);
  doc.text(`Generated: ${new Date().toLocaleString()}`, pageWidth / 2, 27, { align: 'center' });

  // Table
  const headers = columns.map((col) => col.label);
  const body = data.map((item) =>
    columns.map((col) => {
      const value = col.key.split('.').reduce(
        (obj: Record<string, unknown> | undefined, key: string) =>
          obj?.[key] as Record<string, unknown> | undefined,
        item as Record<string, unknown>
      );
      if (col.format) {
        return col.format(value, item);
      }
      return value == null ? '' : String(value);
    })
  );

  autoTable(doc, {
    startY: 33,
    head: [headers],
    body,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [60, 60, 60],
    },
    margin: { left: 14, right: 14 },
  });

  const timestamp = new Date().toISOString().split('T')[0];
  const finalFilename = filename || `${title.toLowerCase().replace(/\s+/g, '-')}-${timestamp}.pdf`;
  doc.save(finalFilename);
}
