import { useEffect, useRef } from 'react';
import { createBurstDetector, isTextEntryTarget } from '../utils/barcodeScanner';

/** Global scanner listener; bursts typed into regular text inputs are ignored. */
export function useBarcodeScanner(onScan: (code: string) => void, enabled = true): void {
  const handler = useRef(onScan);
  useEffect(() => {
    handler.current = onScan;
  });
  useEffect(() => {
    if (!enabled) return;
    const detect = createBurstDetector();
    const onKey = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const code = detect(e.key, e.timeStamp);
      if (code && !isTextEntryTarget(e.target)) {
        e.preventDefault();
        handler.current(code);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [enabled]);
}
