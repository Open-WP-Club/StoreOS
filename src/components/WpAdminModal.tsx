import { useEffect, useRef } from 'react';

interface WpAdminModalProps {
  isOpen: boolean;
  url: string;
  title?: string;
  onClose: () => void;
}

/**
 * Opens WP Admin outside the app renderer. In Electron the main process opens a
 * sandboxed window with its own session partition, locked to the store origin
 * (no <webview>, no iframe). In a plain browser it opens a noopener tab.
 * Renders nothing; `onClose` fires once the request has been handed off.
 */
export default function WpAdminModal({ isOpen, url, onClose }: WpAdminModalProps): null {
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen || !url) return;
    const api = window.electronAPI;
    if (api?.openWpAdmin) {
      void api.openWpAdmin(url).finally(() => onCloseRef.current());
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
      onCloseRef.current();
    }
  }, [isOpen, url]);

  return null;
}
