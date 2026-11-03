import { describe, it, expect } from 'vitest';
import { buildReceipt, renderReceiptHtml, escapeHtml } from '../receipt';
import useAppSettings from '../../stores/appSettingsStore';

const base = {
  storeName: 'Shop',
  items: [
    { name: 'A', quantity: 2, price: 10 },
    { name: 'B', quantity: 1, price: 5.5 },
  ],
  discount: 5.5,
  total: 20,
  paymentMethod: 'Каса',
  tendered: 50,
  change: 30,
  orderId: 42,
  date: '2026-01-02T10:00:00Z',
};

describe('buildReceipt', () => {
  it('computes lines, subtotal, vat and change', () => {
    const r = buildReceipt(base);
    expect(r.lines[0]).toMatchObject({ total: 20 });
    expect(r.subtotal).toBe(25.5);
    expect(r.discount).toBe(5.5);
    expect(r.vat).toBe(3.33); // 20 * 20 / 120
    expect(r.change).toBe(30);
    expect(r.orderId).toBe(42);
  });
  it('marks offline sales as pending and drops empty tender', () => {
    const r = buildReceipt({ ...base, orderId: 0, tendered: 0, change: 0 });
    expect(r.orderId).toBeNull();
    expect(r.tendered).toBeNull();
    expect(renderReceiptHtml(r)).toContain('Чака синхронизация');
  });
});

describe('renderReceiptHtml', () => {
  it('escapes untrusted strings', () => {
    const evil = '<img src=x onerror=alert(1)>"\'&';
    const html = renderReceiptHtml(
      buildReceipt({ ...base, storeName: evil, items: [{ name: evil, quantity: 1, price: 1 }] })
    );
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;&quot;&#39;&amp;');
    expect(html).toContain("default-src 'none'");
    expect(html).toContain('80mm');
  });
  it('escapeHtml handles nullish', () => {
    expect(escapeHtml(null)).toBe('');
  });
});

describe('receipt settings', () => {
  it('default off and toggle', () => {
    expect(useAppSettings.getState().autoPrintReceipt).toBe(false);
    useAppSettings.getState().setAutoPrintReceipt(true);
    useAppSettings.getState().setOpenCashDrawer(true);
    expect(useAppSettings.getState().autoPrintReceipt).toBe(true);
    expect(useAppSettings.getState().openCashDrawer).toBe(true);
    useAppSettings.getState().resetAppSettings();
    expect(useAppSettings.getState().autoPrintReceipt).toBe(false);
  });
});

describe('receipt VAT rate', () => {
  it('uses the given rate and hides the VAT line at 0', () => {
    expect(renderReceiptHtml(buildReceipt({ ...base, vatRate: 9 }))).toContain('ДДС 9%');
    expect(renderReceiptHtml(buildReceipt({ ...base, vatRate: 0 }))).not.toContain('ДДС');
  });
  it('defaults receiptVatRate to 20', () => {
    expect(useAppSettings.getState().receiptVatRate).toBe(20);
  });
});

describe('receipt logo', () => {
  it('renders an escaped https logo and drops other schemes', () => {
    const ok = renderReceiptHtml(
      buildReceipt({ ...base, logoUrl: 'https://x.test/a.png?a=1&b="2"' })
    );
    expect(ok).toContain('<img class="logo" src="https://x.test/a.png?a=1&amp;b=&quot;2&quot;"');
    expect(ok).toContain('img-src https:');
    for (const u of [
      'http://x.test/a.png',
      'javascript:alert(1)',
      'data:image/png;base64,AA',
      null,
    ]) {
      expect(renderReceiptHtml(buildReceipt({ ...base, logoUrl: u }))).not.toContain('<img');
    }
  });
});
