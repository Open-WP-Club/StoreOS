import type { WooCommerceMetaData } from '../types';

export const TRACKING_META_KEY = '_storeos_tracking';
/** wc-shipment-tracking plugin meta shape */
const WC_SHIPMENT_TRACKING_KEY = '_wc_shipment_tracking_items';

type MetaWrite = { id?: number; key: string; value: WooCommerceMetaData['value'] };

/** meta_data entries for an order update; reuses existing meta ids so values are replaced, not duplicated. */
export function buildTrackingMeta(
  existing: WooCommerceMetaData[],
  number: string,
  carrier: string,
  now: Date = new Date()
): MetaWrite[] {
  const date = now.toISOString();
  const entries: MetaWrite[] = [
    { key: TRACKING_META_KEY, value: { number, carrier, date } },
    {
      key: WC_SHIPMENT_TRACKING_KEY,
      value: [
        { tracking_provider: carrier, tracking_number: number, date_shipped: date.slice(0, 10) },
      ],
    },
  ];
  return entries.map((m) => {
    const id = existing.find((e) => e.key === m.key)?.id;
    return id === undefined ? m : { id, ...m };
  });
}

export function trackingNote(number: string, carrier: string): string {
  return `Поръчката е изпратена${carrier ? ` с ${carrier}` : ''}. Номер за проследяване: ${number}`;
}
