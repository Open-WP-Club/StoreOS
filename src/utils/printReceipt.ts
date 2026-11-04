import { renderReceiptHtml, type Receipt } from './receipt';
import { getStoreLogo } from './storeLogo';
import useAppSettings from '../stores/appSettingsStore';

/**
 * Print via the main-process IPC. Returns false when not running in Electron or on failure.
 * The cash-drawer kick is untested with real hardware.
 */
export async function printReceipt(
  input: Receipt,
  opts: {
    printer: string | null;
    openDrawer: boolean;
    currencySymbol: string | null;
    /** Store whose logo is printed when the receiptShowLogo setting is on. */
    store?: { id: string; url: string } | null;
  }
): Promise<boolean> {
  let receipt = input;
  const api = window.electronAPI?.receipt;
  if (!api) return false;
  try {
    if (opts.store && !receipt.logoUrl && useAppSettings.getState().receiptShowLogo) {
      receipt = { ...receipt, logoUrl: await getStoreLogo(opts.store.id, opts.store.url) };
    }
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

/** Print arbitrary prepared (escaped) HTML, e.g. product labels, through the same IPC. */
export async function printHtml(html: string, printer: string | null): Promise<boolean> {
  const api = window.electronAPI?.receipt;
  if (!api) return false;
  try {
    return (await api.print({ html, printer, openDrawer: false })).success;
  } catch {
    return false;
  }
}
