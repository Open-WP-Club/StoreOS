import { renderReceiptHtml, type Receipt } from './receipt';

/**
 * Print via the main-process IPC. Returns false when not running in Electron or on failure.
 * The cash-drawer kick is untested with real hardware.
 */
export async function printReceipt(
  receipt: Receipt,
  opts: { printer: string | null; openDrawer: boolean; currencySymbol: string | null }
): Promise<boolean> {
  const api = window.electronAPI?.receipt;
  if (!api) return false;
  try {
    const res = await api.print({
      html: renderReceiptHtml(receipt, opts.currencySymbol),
      printer: opts.printer,
      openDrawer: opts.openDrawer,
    });
    return res.success;
  } catch {
    return false;
  }
}
