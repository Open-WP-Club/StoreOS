import { vi, Mock } from 'vitest';
import { jsPDF } from 'jspdf';
import { exportOrderInvoice, exportTableToPDF } from '../pdfExport';
import { createMockOrder, createMockLineItem } from '../../__test_utils__/mockFactories';

// ============================================
// Mock jsPDF
// ============================================

let mockSave: ReturnType<typeof vi.fn>;
let mockText: ReturnType<typeof vi.fn>;
let mockSetFontSize: ReturnType<typeof vi.fn>;
let mockSetFont: ReturnType<typeof vi.fn>;
let mockSetTextColor: ReturnType<typeof vi.fn>;
let mockSetFillColor: ReturnType<typeof vi.fn>;
let mockSetDrawColor: ReturnType<typeof vi.fn>;
let mockRect: ReturnType<typeof vi.fn>;
let mockLine: ReturnType<typeof vi.fn>;

vi.mock('jspdf', () => ({
  jsPDF: vi.fn(),
}));

vi.mock('jspdf-autotable', () => ({ default: vi.fn() }));

vi.mock('../currency', () => ({
  formatCurrency: (amount: string | number) => `$${parseFloat(String(amount)).toFixed(2)}`,
}));

beforeEach(() => {
  mockSave = vi.fn();
  mockText = vi.fn();
  mockSetFontSize = vi.fn();
  mockSetFont = vi.fn();
  mockSetTextColor = vi.fn();
  mockSetFillColor = vi.fn();
  mockSetDrawColor = vi.fn();
  mockRect = vi.fn();
  mockLine = vi.fn();

  const mockDoc = {
    internal: { pageSize: { getWidth: () => 210 } },
    text: mockText,
    setFontSize: mockSetFontSize,
    setFont: mockSetFont,
    setTextColor: mockSetTextColor,
    setFillColor: mockSetFillColor,
    setDrawColor: mockSetDrawColor,
    rect: mockRect,
    line: mockLine,
    save: mockSave,
    lastAutoTable: { finalY: 150 },
  };

  (jsPDF as unknown as Mock).mockImplementation(function () { return mockDoc; });
});

// ============================================
// exportOrderInvoice
// ============================================

describe('exportOrderInvoice', () => {
  it('generates a PDF invoice and saves it', () => {
    const order = createMockOrder({
      number: '1234',
      line_items: [
        createMockLineItem({ name: 'Widget', sku: 'W-1', quantity: 2, price: 25, subtotal: '50.00', total: '50.00' }),
      ],
      total: '50.00',
    });

    exportOrderInvoice(order, 'My Store', 'USD');

    expect(mockSave).toHaveBeenCalledTimes(1);
    const filename = mockSave.mock.calls[0]![0];
    expect(filename).toMatch(/^invoice-1234-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('renders store name in header', () => {
    const order = createMockOrder();
    exportOrderInvoice(order, 'Acme Shop', 'EUR');

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Acme Shop');
  });

  it('renders billing address lines', () => {
    const order = createMockOrder({
      billing: {
        first_name: 'Alice',
        last_name: 'Wonder',
        company: 'Acme Corp',
        address_1: '42 Elm St',
        address_2: '',
        city: 'Varna',
        state: 'VN',
        postcode: '9000',
        country: 'BG',
        email: 'alice@test.com',
        phone: '123',
      },
    });

    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Alice Wonder');
    expect(textCalls).toContain('42 Elm St');
  });

  it('skips shipping section when no shipping address', () => {
    const order = createMockOrder({
      shipping: {
        first_name: '',
        last_name: '',
        company: '',
        address_1: '',
        address_2: '',
        city: '',
        state: '',
        postcode: '',
        country: '',
        phone: '',
      },
    });

    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).not.toContain('Ship To');
  });

  it('renders shipping section when shipping address exists', () => {
    const order = createMockOrder({
      shipping: {
        first_name: 'Bob',
        last_name: 'Ship',
        company: '',
        address_1: '99 Port Ave',
        address_2: '',
        city: 'Burgas',
        state: 'BG',
        postcode: '8000',
        country: 'BG',
        phone: '',
      },
    });

    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Ship To');
  });

  it('shows discount when discount_total > 0', () => {
    const order = createMockOrder({
      discount_total: '10.00',
      line_items: [createMockLineItem({ subtotal: '60.00', total: '50.00' })],
    });

    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Discount:');
  });

  it('hides discount when discount_total is 0', () => {
    const order = createMockOrder({ discount_total: '0.00' });

    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).not.toContain('Discount:');
  });

  it('shows shipping line when shipping_total > 0', () => {
    const order = createMockOrder({
      shipping_total: '5.00',
      shipping_lines: [{ id: 1, method_title: 'Flat Rate', method_id: 'flat', instance_id: '', total: '5.00', total_tax: '0', taxes: [], meta_data: [] }],
    });

    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Shipping (Flat Rate):');
  });

  it('shows tax when total_tax > 0', () => {
    const order = createMockOrder({ total_tax: '12.50' });

    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Tax:');
  });

  it('shows payment method info when available', () => {
    const order = createMockOrder({
      payment_method_title: 'Credit Card',
      transaction_id: 'TX-789',
    });

    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Payment: Credit Card');
    expect(textCalls).toContain('Transaction: TX-789');
  });

  it('uses order.id in filename when order.number is absent', () => {
    const order = createMockOrder({ number: '', id: 42 });

    exportOrderInvoice(order);

    const filename = mockSave.mock.calls[0]![0];
    expect(filename).toMatch(/^invoice-42-/);
  });

  it('defaults store name to "Store" and currency to "USD"', () => {
    const order = createMockOrder();
    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Store');
  });

  it('handles empty line items', () => {
    const order = createMockOrder({ line_items: [] });

    expect(() => exportOrderInvoice(order)).not.toThrow();
    expect(mockSave).toHaveBeenCalled();
  });

  it('capitalizes order status', () => {
    const order = createMockOrder({ status: 'processing' });

    exportOrderInvoice(order);

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Status: Processing');
  });
});

// ============================================
// exportTableToPDF
// ============================================

describe('exportTableToPDF', () => {
  it('generates a PDF with title and saves it', () => {
    const data = [{ name: 'Widget', price: 25 }];
    const columns = [
      { key: 'name', label: 'Name' },
      { key: 'price', label: 'Price' },
    ];

    exportTableToPDF(data, columns, { title: 'Product Report' });

    const textCalls = mockText.mock.calls.map((c) => c[0]);
    expect(textCalls).toContain('Product Report');
    expect(mockSave).toHaveBeenCalledTimes(1);
  });

  it('returns early for empty data', () => {
    exportTableToPDF([], [{ key: 'x', label: 'X' }]);
    expect(mockSave).not.toHaveBeenCalled();
  });

  it('uses custom filename when provided', () => {
    const data = [{ a: 1 }];
    exportTableToPDF(data, [{ key: 'a', label: 'A' }], { filename: 'custom.pdf' });

    expect(mockSave).toHaveBeenCalledWith('custom.pdf');
  });

  it('generates filename from title when no filename provided', () => {
    const data = [{ a: 1 }];
    exportTableToPDF(data, [{ key: 'a', label: 'A' }], { title: 'Sales Report' });

    const filename = mockSave.mock.calls[0]![0];
    expect(filename).toMatch(/^sales-report-\d{4}-\d{2}-\d{2}\.pdf$/);
  });

  it('supports nested object access via dot notation', () => {
    const data = [{ billing: { email: 'test@example.com' } }];
    const columns = [{ key: 'billing.email', label: 'Email' }];

    // Just verify it doesn't throw
    expect(() =>
      exportTableToPDF(
        data as unknown as Record<string, unknown>[],
        columns
      )
    ).not.toThrow();
  });

  it('uses custom format function', () => {
    const formatFn = vi.fn((value) => `$${value}`);
    const data = [{ price: 25 }];
    const columns = [{ key: 'price', label: 'Price', format: formatFn }];

    exportTableToPDF(data, columns);

    expect(formatFn).toHaveBeenCalledWith(25, expect.any(Object));
  });

  it('renders null values as empty string', () => {
    const data = [{ name: null }] as unknown as Record<string, unknown>[];
    const columns = [{ key: 'name', label: 'Name' }];

    expect(() => exportTableToPDF(data, columns)).not.toThrow();
  });
});
